# Product Requirements Document (PRD)  
## “Stunning Training Tracker” – Rowing Machine Companion App

---

## 1. Product Summary

A visually stunning, data-driven training tracker app for indoor rowing sessions.  
The app imports CSV files exported from the user’s **SmartRow** account and transforms them into rich, interactive analytics: trends, PRs, training load, and progress over time.

**Tagline:**  
> “Turn your SmartRow CSVs into a beautiful personal rowing coach.”

---

## 2. Goals & Non-Goals

### 2.1 Primary Goals (v1)

1. **Centralize training history** from SmartRow CSV exports in one app.
2. **Generate insightful, attractive statistics** that are easy to understand at a glance.
3. **Enable users to discover trends** (e.g., improvement in pace, power, volume, consistency).
4. **Make data exploration enjoyable**, with a sleek, modern UI and smooth interactions.

### 2.2 Non-Goals (v1)

- Direct SmartRow API integration (only CSV uploads for v1).
- Real-time workout tracking (no live connection to the rowing machine).
- Social network / “follow friends” features.
- Complex training plan generation or coaching (beyond simple recommendations / insights).

---

## 3. Target Platforms

- **Primary:** Responsive Web App (desktop-first, great on tablet, acceptable on mobile).
- **Future Consideration:** PWA capabilities (add to home screen, offline view for recent sessions).

---

## 4. User Personas

### 4.1 Data-Loving Rower (“The Analyst”)

- Owns a SmartRow-enabled rowing machine.
- Regularly exports data from SmartRow.
- Wants deeper insight than the default SmartRow app provides (performance trends, PRs, long-term progress).

### 4.2 Motivated Athlete (“The Grinder”)

- Rows 3–6 times per week.
- Uses stats mainly for motivation (streaks, personal bests, milestones).
- Wants simple answers: “Am I getting better?” “How consistent am I?”

---

## 5. User Journeys (High Level)

### 5.1 First-Time User

1. Lands on app → sees a welcome screen explaining CSV-based data import.
2. Clicks **“Upload SmartRow CSV”**.
3. Uploads one or more CSVs.
4. Sees a **“Processing…”** state, then a **“Setup Complete”** summary:
   - Total sessions imported
   - Total distance/time
   - Recent period overview (last 30 days)
5. Arrives at **Dashboard** with key cards and charts.

### 5.2 Returning User

1. Opens app.
2. Sees most recent stats & trends (e.g., last 7/30 days).
3. Uploads newer CSV export to update training history (duplicate sessions handled gracefully).
4. Reviews:
   - Progress since last login
   - New PRs
   - Updated streaks/consistency

### 5.3 Deep Dive Session Review

1. From dashboard, clicks on a specific session.
2. Views detailed breakdown:
   - Session metadata
   - Graphs over time (pace, power, stroke rate, HR if available)
   - Comparison to similar past sessions.

---

## 6. Functional Requirements

### 6.1 CSV Upload & Data Import

**FR-1**: User can upload at least one CSV file via drag-and-drop or file picker.  
**FR-2**: App supports **SmartRow CSV format** including at minimum:

- Session date/time
- Duration
- Distance
- Average pace / 500m
- Average power (W)
- Stroke rate (spm)
- Total strokes
- (If available) Heart rate metrics
- Any per-interval or per-stroke breakdown columns present

**FR-3**: The system validates CSV structure:

- On success: show “X sessions imported”, “Y duplicates ignored”.
- On failure: show clear error (e.g., “File format not recognized. Please export from SmartRow using [instructions].”).

**FR-4**: Support for incremental imports:

- Users can upload new CSV exports periodically.
- Already-imported sessions detected and skipped (based on unique key: combination of timestamp + duration + distance, or SmartRow session id if present).

**FR-5**: Basic data cleaning & normalization:

- Handle European/US decimal separators.
- Normalize units (e.g., meters vs kilometers, seconds vs formatted hh:mm:ss).
- Robust handling of missing or malformed values, with clear user feedback if a row is skipped.

---

### 6.2 Core Screens & Navigation

#### 6.2.1 Dashboard

**FR-6**: Dashboard shows at a glance:

- Upcoming chart: training volume over time (distance & duration) – default: last 30 days.
- Key metric cards:
  - Total distance (all-time + last 30 days)
  - Total duration (all-time + last 30 days)
  - Average pace / 500m (last 30 days)
  - Average power (last 30 days)
- “Streak” indicator:
  - Current active streak (days/week with at least one session).
  - Best streak ever.

**FR-7**: Trend charts:

- Distance/time per week.
- Avg pace per week.
- Power trend per week.
- Toggle between time ranges: 4 weeks / 3 months / 12 months / all-time.

#### 6.2.2 Sessions List

**FR-8**: Paginated / scrollable list of all sessions with:

- Date & time
- Session type (if available from SmartRow: e.g., “Intervals”, “Steady”)
- Distance
- Duration
- Avg pace
- Avg power
- Stroke rate

**FR-9**: Filters & sorting:

- Filter by: date range, session type, minimum distance/duration.
- Sort by: date, distance, pace, power.

#### 6.2.3 Session Detail View

**FR-10**: Session detail shows:

- Metadata: date, time, duration, distance, average pace, average power, average stroke rate, total strokes, HR stats (if available).
- Visual timeline charts:
  - Pace vs. time.
  - Power vs. time.
  - Stroke rate vs. time.
  - HR vs. time.

**FR-11**: If interval data exists:

- Display intervals table:
  - Interval index
  - Distance/Time
  - Avg pace
  - Avg power
  - Stroke rate
- Display interval-based charts (pace/power per interval).

**FR-12**: “Compare to similar sessions”:

- Suggest 3–5 past sessions with similar distance or duration.
- Show basic side-by-side metrics (avg pace, power, HR).

---

### 6.3 Statistics & Insights

#### 6.3.1 Performance Metrics

**FR-13**: Compute and display:

- Best (fastest) pace for standard distances:
  - 500m, 1000m, 2000m, 5000m, 30 min, 60 min.
- All-time personal bests (PRs) with date tags.
- Average stroke rate across time and per session type.

**FR-14**: Highlight PRs:

- A dedicated “PRs” section.
- In session list, mark sessions that contain a PR badge.

#### 6.3.2 Volume & Consistency

**FR-15**: Weekly/monthly summaries:

- Total distance rowed.
- Total time on machine.
- Number of sessions.

**FR-16**: Consistency indicators:

- Weeks with ≥ X sessions (configurable X, default 3).
- Streak of consecutive weeks meeting the consistency target.

#### 6.3.3 Intensity & Load (Basic Approximation)

**FR-17**: Show an approximate “training load” metric per session and per week:

- E.g., simple formula combining duration and power (or distance and pace).
- Visualize training load over time to show peaks & troughs.

**FR-18**: Simple insights:

- “You’ve increased your weekly distance by X% vs. last month.”
- “This was one of your top 5 hardest weeks in terms of training load.”
- “Your average 2k equivalent pace improved by X sec / 500m over the last Y weeks.”

*(Exact algorithms can be refined later; v1 may use straightforward formulas.)*

---

### 6.4 Filters, Comparisons & Exploration

**FR-19**: Time range filters at the app level (affect major charts):

- Last 7 days, 30 days, 90 days, this year, all-time, custom date range.

**FR-20**: Comparison view:

- Compare two arbitrary sessions:
  - Key metrics side by side (distance, duration, pace, power, stroke rate).
  - Overlaid charts for pace / power vs. time.

**FR-21**: Aggregated comparison:

- Compare periods: e.g., this month vs last month, this year vs last year.
- High-level summary: average distance/week, avg pace, avg power.

---

### 6.5 Export & Data Management

**FR-22**: Data export:

- Export processed sessions as CSV (normalized) for backup/use elsewhere.

**FR-23**: Data management:

- Ability to clear all imported data (with confirmation dialog).
- Ability to re-import from scratch (e.g., after updated CSV structure).

---

### 6.6 Settings & Personalization

**FR-24**: User preferences:

- Preferred units (if needed, e.g., meters vs kilometers, watts vs %).
- Default dashboard time range.
- Target training frequency (for consistency calculation).

**FR-25**: Theme:

- **Default theme:** modern, visually rich UI (likely a **dark theme** that highlights charts).
- User can switch between dark/light if feasible in v1 (nice-to-have).

---

## 7. UX & Visual Design Requirements

**UX-1**: “Stunning” design characteristics:

- Clean, modern typography.
- Strong visual hierarchy: key metrics in bold cards at the top.
- Smooth micro-interactions:
  - Hover states.
  - Subtle animations for chart transitions and card updates.

**UX-2**: Charts:

- Intuitive, minimal clutter.
- Tooltips on hover with exact values.
- Legends clearly distinguish metrics (e.g., pace vs power).

**UX-3**: Responsiveness:

- Desktop: multi-column dashboards, roomy charts.
- Tablet: stack charts and cards but preserve clarity.
- Mobile: vertical stacking, collapsible sections.

**UX-4**: Empty states:

- Before any upload: inspirational copy and a clear CTA to upload SmartRow CSVs.
- If date range has no sessions: friendly message, suggestion to broaden filters.

---

## 8. Data Model (Conceptual)

### 8.1 Entities

- **User**
  - id
  - preferences (units, default range, target frequency)

- **Session**
  - id (internal)
  - external_id (if SmartRow provides one)
  - user_id
  - date_time
  - duration_sec
  - distance_m
  - avg_pace_sec_per_500m
  - avg_power_w
  - avg_stroke_rate_spm
  - total_strokes
  - avg_hr / max_hr (optional)
  - session_type (steady, intervals, test, unknown)
  - source_file_id (CSV file metadata)

- **Interval** (optional, if available)
  - id
  - session_id
  - index
  - duration_sec
  - distance_m
  - avg_pace_sec_per_500m
  - avg_power_w
  - avg_stroke_rate_spm
  - avg_hr / max_hr

- **DerivedMetrics / Aggregates**  
  (can be computed on the fly or cached)
  - weekly_summary
  - monthly_summary
  - training_load_per_session/week
  - PRs

---

## 9. Non-Functional Requirements

**NFR-1 Performance:**  
- Dashboard load ≤ 2 seconds for up to 2,000 sessions on a typical modern device.  
- Charts should be responsive to filter changes with minimal lag.

**NFR-2 Scalability:**  
- Architecture should reasonably handle up to 10,000 sessions per user without rework.

**NFR-3 Security & Privacy:**

- No unnecessary personal data beyond what’s required for account & settings.
- All data in transit over HTTPS.
- Clear privacy statement: CSV data is only used for charts/stats and not shared.

**NFR-4 Reliability:**

- Graceful handling of corrupted uploads, with useful error messages.
- No data corruption on partially failed uploads (atomic import where possible).

---

## 10. Dependencies & Assumptions

- **Assumption:** SmartRow CSV export format is stable enough for v1 parsing.  
- **Dependency:** Access to a sample set of real SmartRow CSV files for development & testing.  
- **Assumption:** Users are comfortable with periodic manual CSV exports.

---

## 11. Out of Scope (for v1 but Future-Candidate Features)

- Direct SmartRow API sync for automatic updates.
- Social sharing of workouts or leaderboards.
- Integration with other training platforms (Strava, TrainingPeaks, etc.).
- Advanced analytics: machine-learning based predictions, sophisticated fatigue models.
- Multi-user “coach” view (coach monitoring multiple athletes).

---

## 12. Release Criteria (v1)

### Functional

- User can upload at least one SmartRow CSV and see:
  - Imported sessions list
  - Dashboard with key stats and volume chart
  - Session detail with at least one time-series chart
  - PRs and basic weekly/monthly aggregates.

### Usability

- 5+ test users can successfully:
  - Import CSV without guidance.
  - Understand main dashboard metrics.
  - Find a specific session and view details.

### Quality

- No critical, data-corrupting bugs.
- CSV parsing robust for at least 95% of test CSVs provided.
- Unit & integration tests in place for parsing and key aggregate logic.

---

## 13. AI Data Analysis & Suggestions (Future Enhancement)

### 13.1 Feature Overview

Leverage artificial intelligence to analyze user's rowing data and provide personalized insights, training recommendations, and performance optimization suggestions. This transforms the app from a data visualization tool into an intelligent training companion.

### 13.2 AI Analysis Categories

#### 13.2.1 Performance Trend Analysis
- **Pace Improvement Detection**: Identify significant improvements or declines in average pace over time
- **Power Progress Tracking**: Analyze power output trends and plateau detection
- **Consistency Patterns**: Evaluate training regularity and its impact on performance
- **Seasonal Variations**: Detect performance changes based on training frequency and intensity

#### 13.2.2 Training Optimization
- **Optimal Training Load**: Suggest ideal workout frequency and duration based on performance data
- **Recovery Recommendations**: Identify signs of overtraining and recommend rest periods
- **Technique Improvement Areas**: Analyze stroke rate consistency and power application patterns
- **Goal Setting Assistance**: Provide realistic time-based goals based on current trajectory

#### 13.2.3 Anomaly Detection
- **Unusual Performance Patterns**: Flag outlier sessions that may indicate technique issues or equipment problems
- **Injury Risk Assessment**: Monitor for patterns that commonly precede rowing injuries
- **Equipment Performance**: Detect potential issues with rowing machine based on data inconsistencies

#### 13.2.4 Comparative Analysis
- **Peer Benchmarking**: Compare performance against similar user profiles (anonymized data)
- **Personal Best Prediction**: Estimate potential PR times based on current training trends
- **Training Efficiency**: Rate the effectiveness of different workout types for individual users

### 13.3 Implementation Phases

#### Phase 1: Basic Statistical Analysis (Local)
- **Local Algorithms**: Implement rule-based analysis without external AI dependencies
- **Pattern Recognition**: Simple trend detection using mathematical algorithms
- **Basic Recommendations**: Generic training suggestions based on performance data
- **Privacy First**: All analysis performed locally, no data externalization

#### Phase 2: Advanced Pattern Detection
- **Machine Learning Models**: Local ML models for more sophisticated pattern recognition
- **Personalized Insights**: Tailored recommendations based on individual training history
- **Predictive Analytics**: Performance forecasting based on training trends
- **Advanced Anomaly Detection**: Statistical outlier identification

#### Phase 3: AI-Powered Intelligence (Cloud)
- **External AI Integration**: Connect to AI services (OpenAI GPT, Anthropic Claude) for deep analysis
- **Natural Language Insights**: Human-readable explanations and recommendations
- **Contextual Understanding**: AI that understands rowing-specific training principles
- **Adaptive Learning**: System improves recommendations based on user feedback

### 13.4 Technical Considerations

#### 13.4.1 Data Privacy & Security
- **Local-First Approach**: Phase 1-2 keep all data processing local
- **Data Anonymization**: Remove personally identifiable information before external processing
- **User Consent**: Explicit opt-in for cloud-based AI features
- **GDPR Compliance**: Ensure data handling meets privacy regulations

#### 13.4.2 Implementation Architecture
- **API Integration**: Secure API calls to AI services with proper authentication
- **Response Caching**: Cache AI responses to minimize costs and improve performance
- **Rate Limiting**: Implement usage limits to control API costs
- **Fallback Mechanisms**: Graceful degradation when AI services are unavailable

#### 13.4.3 Cost Management
- **Usage Monitoring**: Track API call costs and implement usage alerts
- **Tiered Features**: Basic analysis free, advanced AI features premium
- **Batch Processing**: Analyze multiple sessions in single API calls for efficiency
- **Smart Caching**: Avoid redundant analysis for unchanged data

### 13.5 User Experience

#### 13.5.1 Insight Delivery
- **Dashboard Integration**: AI insights displayed prominently on main dashboard
- **Actionable Recommendations**: Clear, specific suggestions users can implement
- **Progress Tracking**: Show how AI predictions compare to actual results
- **Learning System**: Improve recommendations based on user feedback and results

#### 13.5.2 Customization Options
- **Analysis Frequency**: Choose how often to receive AI insights (daily, weekly, monthly)
- **Focus Areas**: Select which types of analysis are most relevant (performance, technique, recovery)
- **Notification Preferences**: Control when and how insights are delivered
- **Data Sharing Controls**: Granular control over what data is used for AI analysis

---

## 14. Open Questions (to be refined during design/implementation)

1. Exact SmartRow CSV column names and structure (must be confirmed with real samples).
2. Which PR distances/durations matter most to the target user (2k, 5k, 30 min, etc.)?
3. Level of configuration allowed for “training load” calculation in v1 (fixed vs configurable formula).
4. Whether to lock in a dark UI by default or support light/dark toggle at launch.

---
