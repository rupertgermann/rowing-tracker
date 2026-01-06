import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

/**
 * SmartRow Sync API
 * 
 * Downloads workout data from SmartRow website using browser automation.
 * Follows the export flow:
 * 1. Login to https://smartrow.fit/my-workouts/
 * 2. Click "Export All" -> Download CSV (list of workouts)
 * 3. Click "Export All" again -> Download ZIP (detailed workout files)
 */

interface SyncRequest {
    email: string;
    password: string;
}

interface SyncResponse {
    success: boolean;
    error?: string;
    csvData?: string;
    zipData?: string; // Base64 encoded ZIP file
    message?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<SyncResponse>> {
    let browser = null;
    let tempDir = '';

    try {
        const body: SyncRequest = await request.json();

        if (!body.email || !body.password) {
            return NextResponse.json({
                success: false,
                error: 'Email and password are required'
            }, { status: 400 });
        }

        // Create a temporary directory for downloads
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smartrow-'));

        // Launch headless browser
        browser = await chromium.launch({
            headless: true,
        });

        const context = await browser.newContext({
            acceptDownloads: true,
        });

        const page = await context.newPage();

        // Step 1: Navigate to SmartRow workouts page
        await page.goto('https://smartrow.fit/my-workouts/', {
            waitUntil: 'networkidle',
            timeout: 30000,
        });

        // SmartRow embeds the actual app in an iframe
        const frame = page.frameLocator('iframe[src*="portal"]');

        // Step 2: Fill login form
        // Wait for the iframe content to load and username input to be available
        try {
            await frame.locator('input[name="username"]').waitFor({ state: 'visible', timeout: 15000 });
        } catch (e) {
            throw new Error('Login form not found. The website structure might have changed.');
        }

        // Fill email using robust name selector
        await frame.locator('input[name="username"]').fill(body.email);

        // Fill password
        await frame.locator('input[name="password"]').fill(body.password);

        // Step 3: Click login button
        const loginButton = frame.locator('button[type="submit"]');
        await loginButton.click();

        // Wait for login to complete and find the "Export all" link
        const exportLink = frame.locator('a').filter({ hasText: 'Export all' }).first();

        try {
            await exportLink.waitFor({ state: 'visible', timeout: 20000 });
        } catch (e: any) {
            // Check for login errors if we can't find the export link
            const invalidCreds = await frame.getByText('Invalid username or password').isVisible();
            if (invalidCreds) {
                throw new Error('Invalid email or password');
            }
            throw new Error('Login failed or could not find "Export all" button. ' + e.message);
        }

        // Step 5: Click "Export All" button for CSV
        let csvData = '';
        let zipDataBase64 = '';

        try {
            console.log('Clicking "Export all" link for summary...');
            await exportLink.click();

            // Wait for options dialog to be visible first
            await frame.locator('mat-dialog-container, .mat-dialog-container').waitFor({ state: 'visible', timeout: 10000 });

            // Get all links in the dialog to debug
            const allLinks = await frame.locator('a').all();
            console.log(`Found ${allLinks.length} links in export dialog`);

            for (let i = 0; i < allLinks.length; i++) {
                const link = allLinks[i];
                const text = await link.textContent().catch(() => 'N/A');
                const href = await link.getAttribute('href').catch(() => 'N/A');
                console.log(`  Link ${i}: text="${text?.trim()}", href="${href}"`);
            }

            // Find the workout summary CSV (NOT stroke-by-stroke data)
            // Stroke CSV has columns: Stroke (#), Second (#), Timestamp (UTC), Distance (m), Work (J)...
            // Summary CSV has columns: Time stamp (UTC), Distance (m), Time, Energy (kCal)...
            let targetLink = null;

            // Collect link info for better selection
            const linkInfos = await Promise.all(allLinks.map(async (link) => {
                const text = await link.textContent().then(t => t?.trim() || '');
                const href = await link.getAttribute('href').then(h => h?.trim() || '');
                const textLower = text.toLowerCase();
                const hrefLower = href.toLowerCase();
                return { link, text, href, textLower, hrefLower };
            }));

            // Try to find link that's NOT stroke data
            // Stroke data links typically mention "stroke" or individual workout files
            // CRITICAL: We need EU format (csv-eu-list) which uses semicolon delimiter
            // US format (csv-us-list) uses commas and will fail parsing
            for (const { link, text, textLower, hrefLower } of linkInfos) {
                const isCsv = hrefLower.includes('.csv') || textLower.includes('.csv');
                const isNotStroke = !textLower.includes('stroke') && !textLower.includes('individual') && !textLower.includes('workout file');

                // Prioritize EU format (csv-eu-list) for semicolon delimiter
                const isEuFormat = hrefLower.includes('csv-eu-list');

                if (isCsv && isNotStroke) {
                    // If we found EU format, use it immediately
                    if (isEuFormat) {
                        targetLink = link;
                        console.log(`✓ Selected EU format CSV: "${text}" (href: ${hrefLower})`);
                        break;
                    }
                    // Otherwise store as fallback, but keep looking for EU format
                    if (!targetLink) {
                        targetLink = link;
                        console.log(`  Storing as fallback: "${text}" (href: ${hrefLower})`);
                    }
                }
            }

            // Fallback: use href pattern if text matching failed
            if (!targetLink) {
                console.warn('Text matching failed, trying href patterns...');
                const euListLink = frame.locator('a[href*="/api/export/csv-eu-list"]').first();
                if (await euListLink.isVisible().catch(() => false)) {
                    targetLink = euListLink;
                    console.log('✓ Using csv-eu-list link');
                } else {
                    targetLink = frame.locator('a').filter({ hasText: '.csv' }).first();
                    console.warn('⚠ Using fallback - first .csv link (might be wrong format)');
                }
            }

            // Download the selected link
            console.log('Starting CSV summary download...');
            const [csvDownload] = await Promise.all([
                page.waitForEvent('download', { timeout: 30000 }),
                targetLink.click(),
            ]);

            const csvPath = path.join(tempDir, 'workouts.csv');
            await csvDownload.saveAs(csvPath);
            csvData = await fs.readFile(csvPath, 'utf-8');

            const lines = csvData.split('\n');
            console.log(`CSV summary downloaded. Size: ${csvData.length} chars. Lines: ${lines.length}`);
            console.log(`CSV headers: ${lines[0]}`);

            // Verify it's the right format
            const headers = lines[0].toLowerCase();
            if (headers.includes('stroke (#)') || headers.includes('second (#)')) {
                console.error('⚠ ERROR: Downloaded stroke-by-stroke CSV instead of workout summary!');
                console.error('This CSV will fail validation. Need to download the correct summary CSV.');
            } else if (headers.includes('time stamp (utc)') && headers.includes('distance (m)')) {
                console.log('✓ Correct CSV format (workout summary)');
            }

            console.log(`First 3 lines:\n${lines.slice(0, 3).join('\n')}`);

        } catch (csvError) {
            console.warn('Failed to download summary CSV:', csvError);
        }

        // Step 6: Download Detailed CSV/ZIP
        try {
            await page.waitForTimeout(1000);

            // Re-open export menu if needed (it might close after click)
            if (!await frame.locator('mat-dialog-container, .mat-dialog-container').isVisible()) {
                console.log('Re-opening export menu for detailed download...');
                await exportLink.click();
                // Wait for dialog to be visible
                await frame.locator('mat-dialog-container, .mat-dialog-container').waitFor({ state: 'visible', timeout: 5000 });
            }

            // Get all links again to find detailed export
            const exportLinks = await frame.locator('a').all();
            console.log(`Found ${exportLinks.length} links in export dialog for detailed download`);

            let detailedExport = null;

            // Look for ZIP file containing detailed stroke data for all workouts
            for (let i = 0; i < exportLinks.length; i++) {
                const link = exportLinks[i];
                const text = await link.textContent().catch(() => 'N/A');
                const href = await link.getAttribute('href').catch(() => 'N/A');
                const textLower = (text || '').toLowerCase();
                const hrefLower = (href || '').toLowerCase();

                console.log(`  Detailed link ${i}: text="${text?.trim()}", href="${href}"`);

            // Look for ZIP files or links mentioning "all workouts" or "workout files"
            for (let i = 0; i < exportLinks.length; i++) {
                const link = exportLinks[i];
                const text = await link.textContent().catch(() => 'N/A');
                const href = await link.getAttribute('href').catch(() => 'N/A');
                const textLower = (text || '').toLowerCase();
                const hrefLower = (href || '').toLowerCase();

                console.log(`  Detailed link ${i}: text="${text?.trim()}", href="${href}"`);

                // Look for CSV-EU-ALL which might have detailed data
                const isEuDetailedCsv = hrefLower.includes('csv-eu-all');
                // Look for ZIP files
                const isZip = textLower.includes('.zip') || hrefLower.includes('.zip');
                // Look for links mentioning "all workouts" or "workout files"
                const mentionsAllWorkouts = textLower.includes('all workouts') || textLower.includes('workout files');

                if (isEuDetailedCsv || isZip || mentionsAllWorkouts) {
                    detailedExport = link;
                    console.log(`✓ Found detailed export: "${text}" (href: ${href})`);
                    break;
                }
            }
            }

            // Fallback: look for "csv-eu-all" or "csv-us-all" which might have detailed data
            if (!detailedExport) {
                console.log('No ZIP found, looking for detailed CSV export (csv-eu-all or csv-us-all)...');
                const euAllLink = frame.locator('a[href*="/api/export/csv-eu-all"]').first();
                if (await euAllLink.isVisible().catch(() => false)) {
                    detailedExport = euAllLink;
                    console.log('✓ Found csv-eu-all link (detailed data)');
                } else {
                    const usAllLink = frame.locator('a[href*="/api/export/csv-us-all"]').first();
                    if (await usAllLink.isVisible().catch(() => false)) {
                        detailedExport = usAllLink;
                        console.log('✓ Found csv-us-all link (detailed data)');
                    }
                }
            }

            // Fallback: look for any ZIP link as last resort
            if (!detailedExport) {
                console.log('No detailed export found, looking for any .zip link...');
                detailedExport = frame.locator('a').filter({ hasText: '.zip' }).first();
            }

            if (await detailedExport.isVisible()) {
                console.log('Starting detailed export download...');
                const [detailedDownload] = await Promise.all([
                    page.waitForEvent('download', { timeout: 60000 }),
                    detailedExport.click(),
                ]);

                const suggestedName = detailedDownload.suggestedFilename();
                console.log(`Detailed export filename: ${suggestedName}`);

                if (suggestedName.endsWith('.zip')) {
                    const zipPath = path.join(tempDir, 'workouts.zip');
                    await detailedDownload.saveAs(zipPath);
                    const zipBuffer = await fs.readFile(zipPath);
                    zipDataBase64 = zipBuffer.toString('base64');
                    console.log(`✓ ZIP downloaded. Size: ${zipBuffer.length} bytes.`);
                } else if (suggestedName.endsWith('.csv')) {
                    // It's a CSV, not a ZIP
                    // This might be detailed CSV export or the same summary CSV
                    const detailedPath = path.join(tempDir, 'detailed.csv');
                    await detailedDownload.saveAs(detailedPath);
                    const detailedSize = (await fs.stat(detailedPath)).size;
                    console.log(`⚠ Detailed CSV downloaded instead of ZIP. Size: ${detailedSize} bytes.`);
                    console.log('This will be handled by ZIP parser if it contains multiple sessions.');

                    // Since we got a CSV instead of ZIP, check if it's detailed stroke data
                    const detailedData = await fs.readFile(detailedPath, 'utf-8');
                    const detailedHeaders = detailedData.split('\n')[0]?.toLowerCase() || '';

                    if (detailedHeaders.includes('stroke (#)') || detailedHeaders.includes('second (#)')) {
                        console.log('Downloaded file is stroke data CSV, not ZIP.');
                        console.log('Cannot process without proper ZIP export. Need to find .zip link.');
                    }

                    // Try one more time to find a .zip link
                    console.log('Trying to find explicit .zip link...');
                    const allLinksForZip = await frame.locator('a').all();
                    let zipLink = null;
                    for (const link of allLinksForZip) {
                        const text = await link.textContent().then(t => t?.toLowerCase() || '');
                        const href = await link.getAttribute('href').then(h => h?.toLowerCase() || '');
                        if (text.includes('.zip') || href.includes('.zip')) {
                            zipLink = link;
                            console.log(`Found ZIP link: text="${text}", href="${href}"`);
                            break;
                        }
                    }

                    if (zipLink && await zipLink.isVisible()) {
                        try {
                            const [zipDownloadReal] = await Promise.all([
                                page.waitForEvent('download', { timeout: 30000 }),
                                zipLink.click()
                            ]);
                            const zipPath = path.join(tempDir, 'workouts.zip');
                            await zipDownloadReal.saveAs(zipPath);
                            const zipBuffer = await fs.readFile(zipPath);
                            zipDataBase64 = zipBuffer.toString('base64');
                            console.log(`✓ ZIP downloaded. Size: ${zipBuffer.length} bytes.`);
                        } catch (e) {
                            console.warn('Failed to download ZIP link:', e);
                        }
                    }
                } else {
                    console.warn(`Unexpected file type: ${suggestedName}`);
                }
            } else {
                console.warn('Could not find detailed export option');
            }

        } catch (zipError) {
            console.warn('Failed to download detailed export:', zipError);
        }

        // Close browser
        await browser.close();
        browser = null;

        // Clean up temp directory
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => { });

        // Validate CSV format before returning success
        if (csvData) {
            const csvLines = csvData.split('\n');
            const headers = csvLines[0]?.toLowerCase() || '';

            // Check if it's the wrong format (stroke-by-stroke data)
            const isStrokeData = headers.includes('stroke (#)') || headers.includes('second (#)');

            // Check if it's the right format (workout summary)
            const isWorkoutSummary = headers.includes('time stamp (utc)') &&
                                   headers.includes('distance (m)') &&
                                   headers.includes('time');

            if (isStrokeData) {
                console.error('ERROR: Downloaded stroke-by-stroke CSV instead of workout summary!');
                console.error('This indicates the wrong export link was clicked.');
                // Don't return this CSV as it will fail validation
                csvData = '';
            } else if (!isWorkoutSummary) {
                console.warn('WARNING: CSV format unrecognized. Headers:', csvLines[0]);
                console.warn('This might not be a SmartRow workout summary CSV.');
            }
        }

        if (!csvData && !zipDataBase64) {
            return NextResponse.json({
                success: false,
                error: 'Failed to download any workout data. Please try again or export manually.'
            }, { status: 500 });
        }

        const downloadedTypes = [];
        if (csvData) downloadedTypes.push('CSV');
        if (zipDataBase64) downloadedTypes.push('ZIP');

        console.log(`Download summary: ${downloadedTypes.join(' and ')}`);
        if (downloadedTypes.length === 1 && downloadedTypes[0] === 'CSV') {
            console.log('⚠ Only summary CSV downloaded - detailed workout data not available');
        }

        return NextResponse.json({
            success: true,
            csvData: csvData || undefined,
            zipData: zipDataBase64 || undefined,
            message: `Successfully downloaded ${downloadedTypes.join(' and ')} workout data.`
        });

    } catch (error) {
        console.error('SmartRow sync error:', error);

        // Clean up on error
        if (browser) {
            await browser.close().catch(() => { });
        }
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true }).catch(() => { });
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

        return NextResponse.json({
            success: false,
            error: errorMessage
        }, { status: 500 });
    }
}
