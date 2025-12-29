import { extractText, getDocumentProxy } from 'unpdf';
import { initializeCloudAIFromSettings, isAIAvailable } from '@/lib/aiConfig';

// ============================================================================
// Image Processing
// ============================================================================

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
}

export interface ProcessedImage {
  resizedBlob: Blob;
  thumbnail: Blob;
  metadata: ImageMetadata;
  extractedText?: string; // OCR text from image
}

const MAX_IMAGE_DIMENSION = 2048;
const THUMBNAIL_SIZE = 200;
const JPEG_QUALITY = 0.85;

/**
 * Process an image file: resize if too large, generate thumbnail, extract text via LLM
 */
export async function processImage(file: File): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(url);

      try {
        const metadata: ImageMetadata = {
          width: img.width,
          height: img.height,
          format: file.type,
        };

        // Resize if needed
        const resizedBlob = await resizeImage(img, MAX_IMAGE_DIMENSION, file.type);
        
        // Generate thumbnail
        const thumbnail = await resizeImage(img, THUMBNAIL_SIZE, 'image/jpeg');

        // Extract text from image using LLM (async, don't block)
        let extractedText: string | undefined;
        try {
          extractedText = await extractTextFromImage(file);
        } catch {
          // Text extraction failed, continue without it
        }

        resolve({ resizedBlob, thumbnail, metadata, extractedText });
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Extract text from an image using LLM vision
 */
async function extractTextFromImage(file: File): Promise<string> {
  try {
    initializeCloudAIFromSettings();
    if (!isAIAvailable()) {
      return '';
    }

    const { SettingsService } = await import('@/lib/settings');
    const settings = SettingsService.getInstance();
    const aiSettings = settings.getAISettings();
    
    if (!aiSettings.openaiApiKey) {
      return '';
    }

    // Convert image to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );


    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiSettings.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-nano', // Use nano for simple image text extraction
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_image',
                image_url: `data:${file.type};base64,${base64}`
              },
              {
                type: 'input_text',
                text: 'Extract any text visible in this image. If there is no text, describe the image content briefly. Return only the extracted text or description.'
              }
            ]
          }
        ],
        max_output_tokens: 2000,
        reasoning: { effort: 'none' },
        text: { verbosity: 'low' }
      })
    });

    if (!response.ok) {
      return '';
    }

    const data = await response.json();

    // Parse response - check nested structure first
    const messageOutput = data.output?.find((item: { type: string }) => item.type === 'message');
    if (messageOutput?.content?.length > 0) {
      const textContent = messageOutput.content.find((c: { type: string }) => c.type === 'output_text');
      if (textContent?.text) {
        return textContent.text;
      }
    }

    // Fallback to direct output_text
    return data.output_text || '';
  } catch {
    return '';
  }
}

/**
 * Resize an image to fit within maxSize while maintaining aspect ratio
 */
async function resizeImage(
  img: HTMLImageElement,
  maxSize: number,
  outputType: string
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  let { width, height } = img;

  // Calculate new dimensions
  if (width > maxSize || height > maxSize) {
    if (width > height) {
      height = Math.round((height * maxSize) / width);
      width = maxSize;
    } else {
      width = Math.round((width * maxSize) / height);
      height = maxSize;
    }
  }

  canvas.width = width;
  canvas.height = height;

  // Draw resized image
  ctx.drawImage(img, 0, 0, width, height);

  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      },
      outputType,
      JPEG_QUALITY
    );
  });
}

/**
 * Generate a base64 data URL from a blob
 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

// ============================================================================
// PDF Processing
// ============================================================================

export interface PDFMetadata {
  pageCount: number;
  title?: string;
  author?: string;
}

export interface ProcessedPDF {
  extractedText: string;
  metadata: PDFMetadata;
  thumbnail?: Blob;
}

/**
 * Process a PDF file: extract text and metadata
 * Uses unpdf for text-native PDFs, falls back to LLM vision for scanned PDFs
 */
export async function processPDF(file: File): Promise<ProcessedPDF> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));

    // Extract text using unpdf first (fast, works for text-native PDFs)
    const { totalPages, text } = await extractText(pdf, { mergePages: true });

    // Get metadata
    const metadata: PDFMetadata = {
      pageCount: totalPages,
    };

    // Try to extract PDF info (title, author)
    try {
      const pdfMetadata = await (pdf as unknown as { getMetadata?: () => Promise<{ info?: Record<string, unknown> }> }).getMetadata?.();
      if (pdfMetadata?.info) {
        metadata.title = pdfMetadata.info.Title as string | undefined;
        metadata.author = pdfMetadata.info.Author as string | undefined;
      }
    } catch {
      // Metadata extraction failed, continue without it
    }

    // Check if we got meaningful text (more than just whitespace)
    const extractedText = (text as string).trim();
    const hasText = extractedText.length > 50; // Arbitrary threshold for "meaningful" text

    if (hasText) {
      return {
        extractedText,
        metadata,
      };
    }

    // No text found - this is likely a scanned PDF, use LLM vision
    const llmText = await extractTextWithLLM(file);
    
    return {
      extractedText: llmText,
      metadata,
    };
  } catch (error) {
    console.error('PDF processing failed:', error);
    throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from a scanned PDF using LLM vision
 * Sends the PDF directly to the OpenAI API using input_file
 */
async function extractTextWithLLM(file: File): Promise<string> {
  try {
    // Check if AI is available
    initializeCloudAIFromSettings();
    if (!isAIAvailable()) {
      return '';
    }

    const { SettingsService } = await import('@/lib/settings');
    const settings = SettingsService.getInstance();
    const aiSettings = settings.getAISettings();
    
    if (!aiSettings.openaiApiKey) {
      return '';
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiSettings.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini', // Use mini model for cost efficiency
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_file',
                filename: file.name,
                file_data: `data:application/pdf;base64,${base64}`
              },
              {
                type: 'input_text',
                text: 'Extract ALL text from this PDF document. Return ONLY the extracted text, preserving the original formatting and structure as much as possible. Include all text, numbers, dates, and special terms exactly as written. If there are multiple pages, include text from all pages.'
              }
            ]
          }
        ],
        max_output_tokens: 8000,
        reasoning: { effort: 'low' },
        text: { verbosity: 'high' }
      })
    });

    if (!response.ok) {
      return '';
    }

    const data = await response.json();

    // Parse response
    const messageOutput = data.output?.find((item: { type: string }) => item.type === 'message');
    if (messageOutput?.content?.length > 0) {
      const textContent = messageOutput.content.find((c: { type: string }) => c.type === 'output_text');
      if (textContent?.text) {
        return textContent.text;
      }
    }

    return data.output_text || '';
  } catch {
    return '';
  }
}

/**
 * Extract text from a PDF ArrayBuffer (for already loaded files)
 */
export async function extractPDFText(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text as string;
  } catch {
    return '';
  }
}

// ============================================================================
// Generic File Processing
// ============================================================================

export type ProcessedDocument = 
  | { type: 'image'; data: ProcessedImage }
  | { type: 'pdf'; data: ProcessedPDF };

/**
 * Process any supported document type
 */
export async function processDocument(file: File): Promise<ProcessedDocument> {
  if (file.type.startsWith('image/')) {
    const data = await processImage(file);
    return { type: 'image', data };
  }

  if (file.type === 'application/pdf') {
    const data = await processPDF(file);
    return { type: 'pdf', data };
  }

  throw new Error(`Unsupported file type: ${file.type}`);
}

/**
 * Get a preview URL for a document
 */
export function getDocumentPreviewUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/**
 * Revoke a preview URL to free memory
 */
export function revokeDocumentPreviewUrl(url: string): void {
  URL.revokeObjectURL(url);
}
