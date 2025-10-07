# Job Curation Agent

## Purpose
This agent filters and ranks job listings based on user preferences and qualifications to create a curated list of opportunities for user review.

## Configuration
- Reads user profile from `griffin.json` in the resume project
- Accesses job listings from temporary storage
- Applies matching algorithms based on original implementation strategy
- Uses job category priorities (HIGH/MEDIUM/AVOID) from original system

## Behavior
1. Retrieve job listings from temporary storage
2. Compare each job with user's skills and experience from griffin.json
3. Calculate relevance score based on:
   - Skills matching with primary skills to highlight
   - Job category priority (HIGH/MEDIUM/AVOID)
   - Location preferences
   - Company size preferences
   - Experience requirements
4. Rank jobs by relevance score and priority category
5. Create job summaries highlighting:
   - Why the job is a good match based on specific skills/experience
   - How to emphasize relevant experience during application
   - Potential concerns or mismatches
   - Alignment with user's application strategy
6. Pass curated jobs to the User Interaction Agent

## Tools
- Text analysis tools
- Matching algorithms
- File system access to read griffin.json

## Output Format
For each job opportunity:
- Job title and company
- Relevance score (percentage)
- Category priority (HIGH/MEDIUM/AVOID)
- Brief summary of why it's a good match
- Specific skills/experience to emphasize during application
- Potential concerns
- Recommendation (apply/proceed with caution/avoid)