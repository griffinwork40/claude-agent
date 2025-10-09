// lib/playwright-service.ts
import { chromium, Browser, Page } from 'playwright';

// Type definition for job application data
interface JobApplicationData {
  url: string;
  profileData: Record<string, unknown>; // This would come from griffin.json
  resumePath: string;
}

const toRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const toRecordArray = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value)
    ? value
        .filter((item): item is Record<string, unknown> =>
          item !== null && typeof item === 'object'
        )
    : [];

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

// Main class for handling Playwright automation
export class PlaywrightApplicationService {
  private browser: Browser | null = null;

  async initialize() {
    // Launch the browser when service is initialized
    this.browser = await chromium.launch({
      headless: process.env.NODE_ENV === 'production', // Set to false for debugging in development
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async submitApplication(jobData: JobApplicationData): Promise<{ success: boolean; message: string; details?: Record<string, unknown> }> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    let page: Page | null = null;

    try {
      // Create a new page for this application
      page = await this.browser.newPage();
      
      // Set viewport to look like a real user
      await page.setViewportSize({ width: 1366, height: 768 });
      
      // Navigate to the job application URL
      console.log(`Navigating to: ${jobData.url}`);
      await page.goto(jobData.url, { waitUntil: 'networkidle' });
      
      // Add a small delay to seem more human-like
      await page.waitForTimeout(1000 + Math.random() * 2000);

      // Fill out the application form with profile data
      await this.fillApplicationForm(page, jobData.profileData);

      // Upload the resume
      await this.uploadResume(page, jobData.resumePath);

      // Submit the application
      await this.submitForm(page);

      // Wait for submission confirmation
      await page.waitForTimeout(2000);

      // Check if submission was successful
      const success = await this.checkSubmissionSuccess(page);
      
      if (success) {
        return {
          success: true,
          message: 'Application submitted successfully',
          details: { url: jobData.url }
        };
      } else {
        return {
          success: false,
          message: 'Application submission may have failed - could not verify success',
          details: { url: jobData.url }
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error during application submission:', error);
      return {
        success: false,
        message: `Application failed: ${errorMessage}`,
        details: { url: jobData.url, error: errorMessage }
      };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  private async fillApplicationForm(page: Page, profileData: Record<string, unknown>) {
    // Fill personal information fields
    const personalInfo = toRecord(profileData.personal_information);
    const fullName = typeof personalInfo.full_name === 'string' ? personalInfo.full_name : '';
    const nameParts = fullName.split(' ');
    await this.fillField(page, 'firstName', nameParts[0] || '');
    await this.fillField(page, 'lastName', nameParts.slice(1).join(' ') || '');
    await this.fillField(
      page,
      'email',
      typeof personalInfo.email === 'string' ? personalInfo.email : ''
    );
    await this.fillField(
      page,
      'phone',
      typeof personalInfo.phone === 'string' ? personalInfo.phone : ''
    );
    
    // For more complex selectors, we need to try multiple common selectors
    const email = typeof personalInfo.email === 'string' ? personalInfo.email : '';
    await this.fillField(page, '[data-qa="email"]', email);
    await this.fillField(page, '[data-test="email"]', email);
    await this.fillField(page, 'input[name*="email" i]', email);

    // Fill location
    const address = typeof personalInfo.address === 'string' ? personalInfo.address : '';
    if (address) {
      const addressParts = address.split(',');
      await this.fillField(page, 'city', addressParts[0]?.trim() || '');
      await this.fillField(page, 'state', addressParts[1]?.trim() || '');
      await this.fillField(page, 'zip', addressParts[2]?.trim() || '');
    }

    // Handle other common fields
    const additionalInfo = toRecord(profileData.additional_information);
    await this.fillField(
      page,
      'summary',
      typeof additionalInfo.about === 'string' ? additionalInfo.about : ''
    );
    await this.fillTextarea(page, '[name*="coverletter" i]', this.generateCoverLetter(profileData));

    // Handle work experience
    const employmentHistory = toRecordArray(profileData.employment_history);
    for (const [index, job] of employmentHistory.entries()) {
      await this.fillField(
        page,
        `[name*="company" i][data-index="${index}"]`,
        typeof job.employer_name === 'string' ? job.employer_name : ''
      );
      await this.fillField(
        page,
        `[name*="title" i][data-index="${index}"]`,
        typeof job.job_title === 'string' ? job.job_title : ''
      );
      const responsibilities = toStringArray(job.responsibilities);
      await this.fillTextarea(page, `[name*="description" i][data-index="${index}"]`, responsibilities.join('\n'));
    }

    // Handle education
    const education = toRecordArray(profileData.education);
    for (const [index, edu] of education.entries()) {
      await this.fillField(
        page,
        `[name*="school" i][data-index="${index}"]`,
        typeof edu.institution === 'string' ? edu.institution : ''
      );
      await this.fillField(
        page,
        `[name*="degree" i][data-index="${index}"]`,
        typeof edu.degree === 'string' ? edu.degree : ''
      );
      await this.fillField(
        page,
        `[name*="field" i][data-index="${index}"]`,
        typeof edu.major === 'string' ? edu.major : ''
      );
    }

    // Handle skill fields (if any)
    const skillsAndQuals = toRecord(profileData.skills_and_qualifications);
    const technicalSkills = toStringArray(skillsAndQuals.technical_skills);
    if (technicalSkills.length > 0) {
      const skillsString = technicalSkills.join(', ');
      await this.fillTextarea(page, '[name*="skills" i]', skillsString);
    }

    // Handle availability and legal questions
    const positionAndAvailability = toRecord(profileData.position_and_availability);
    const availabilityValue = positionAndAvailability.availability;
    const availabilityOptions =
      typeof availabilityValue === 'string'
        ? [availabilityValue]
        : toStringArray(availabilityValue);
    if (
      availabilityOptions.some((option) =>
        option.toLowerCase().includes('full-time')
      )
    ) {
      await this.clickCheckbox(page, '[name*="fulltime" i]');
    }

    const workEligibility = toRecord(profileData.work_eligibility_and_legal);
    const legallyAuthorized = workEligibility.legally_authorized_to_work_in_us;
    if (legallyAuthorized === true || legallyAuthorized === 'yes') {
      await this.clickCheckbox(page, '[name*="authorized" i]');
    }

    const requiresSponsorship = workEligibility.require_sponsorship;
    if (requiresSponsorship === false || requiresSponsorship === 'no' || requiresSponsorship === undefined) {
      await this.clickCheckbox(page, '[name*="sponsorship" i]');
    }

    // Handle demographic questions
    const demographicQuestions = toRecord(profileData.demographic_questions);
    const genderIdentity =
      typeof demographicQuestions.gender_identity === 'string'
        ? demographicQuestions.gender_identity
        : '';
    if (genderIdentity) {
      await this.selectOption(page, '[name*="gender" i]', genderIdentity);
    }
  }

  private async fillField(page: Page, selector: string, value: string) {
    if (!value) return;
    
    // Try different selector strategies
    const selectors = [
      `input[name="${selector}"]`,
      `input[id="${selector}"]`,
      `input#${selector}`,
      `input[data-qa="${selector}"]`,
      `*[name*="${selector}" i]`,
      selector
    ];
    
    for (const sel of selectors) {
      try {
        await page.locator(sel).fill(value);
        await page.waitForTimeout(500); // Small delay between fills
        return; // Exit if successful
      } catch {
        continue; // Try next selector
      }
    }
    // If no selector worked, log for debugging
    console.log(`Could not fill field with selector: ${selector}`);
  }

  private async fillTextarea(page: Page, selector: string, value: string) {
    if (!value) return;
    
    const selectors = [
      `textarea[name*="${selector}" i]`,
      `textarea[id*="${selector}" i]`,
      `textarea${selector}`,
      `*[name*="${selector}" i]`,
      selector
    ];
    
    for (const sel of selectors) {
      try {
        await page.locator(sel).fill(value);
        await page.waitForTimeout(500);
        return;
      } catch {
        continue;
      }
    }
  }

  private async clickCheckbox(page: Page, selector: string) {
    const selectors = [
      `input[type="checkbox"][name*="${selector}" i]`,
      `input[type="checkbox"]#${selector}`,
      `input[type="checkbox"][data-qa="${selector}"]`,
      `*[name*="${selector}" i]`,
      selector
    ];
    
    for (const sel of selectors) {
      try {
        await page.locator(sel).click();
        await page.waitForTimeout(500);
        return;
      } catch {
        continue;
      }
    }
  }

  private async selectOption(page: Page, selector: string, value: string) {
    const selectors = [
      `select[name*="${selector}" i]`,
      `select#${selector}`,
      `select[data-qa="${selector}"]`,
      `select[name="${selector}"]`,
      selector
    ];
    
    for (const sel of selectors) {
      try {
        await page.locator(sel).selectOption(value);
        await page.waitForTimeout(500);
        return;
      } catch {
        continue;
      }
    }
  }

  private async uploadResume(page: Page, resumePath: string) {
    // Look for file upload elements
    const fileInputs = await page.locator('input[type="file"]').all();
    
    if (fileInputs.length > 0) {
      // Upload to the first file input we find
      await fileInputs[0].setInputFiles(resumePath);
      await page.waitForTimeout(2000); // Wait for upload to process
    } else {
      console.log('No file upload field found');
    }
  }

  private async submitForm(page: Page) {
    // Try different submit button selectors
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("submit" i)',
      'button:has-text("apply" i)',
      'button:has-text("next" i)',
      '[data-qa="submit"]',
      '[data-test="submit"]',
      '.apply-button',
      '.submit-button'
    ];
    
    for (const selector of submitSelectors) {
      try {
        const element = page.locator(selector);
        const isVisible = await element.isVisible();
        
        if (isVisible) {
          await element.click();
          await page.waitForTimeout(1000);
          return;
        }
      } catch {
        continue;
      }
    }
    
    throw new Error('Could not find submit button');
  }

  private async checkSubmissionSuccess(page: Page): Promise<boolean> {
    // Check for common success indicators
    const successIndicators = [
      'application.*submitted',
      'thank you for applying',
      'application received',
      'we have received your application'
    ];
    
    const pageContent = await page.content();
    
    for (const indicator of successIndicators) {
      const regex = new RegExp(indicator, 'i');
      if (regex.test(pageContent)) {
        return true;
      }
    }
    
    // Check for common success URLs
    const successUrls = [
      /\/application\/success/,
      /\/thank-you/,
      /\/confirmation/,
      /apply\/done/,
      /apply\/success/
    ];
    
    const currentUrl = page.url();
    for (const urlPattern of successUrls) {
      if (urlPattern.test(currentUrl)) {
        return true;
      }
    }
    
    return false;
  }

  private generateCoverLetter(profileData: Record<string, unknown>): string {
    // Generate a personalized cover letter based on profile data
    const personalInfo = toRecord(profileData.personal_information);
    const skillsAndQuals = toRecord(profileData.skills_and_qualifications);
    const employmentHistory = toRecordArray(profileData.employment_history);

    const technicalSkills = toStringArray(skillsAndQuals.technical_skills);
    const businessSkills = toStringArray(skillsAndQuals.business_and_product_skills);
    const fullName = typeof personalInfo.full_name === 'string' ? personalInfo.full_name : '';

    const highlightedTechnicalSkills = technicalSkills.slice(0, 3).join(', ') || 'my technical expertise';
    const firstEmployment = employmentHistory[0];
    const employerName =
      typeof firstEmployment?.employer_name === 'string'
        ? firstEmployment.employer_name
        : 'my previous company';
    const responsibilities = toStringArray(firstEmployment?.responsibilities);
    const primaryResponsibility =
      responsibilities[0] || 'demonstrated expertise in my field';
    const highlightedBusinessSkill = businessSkills[0] || 'professional skills';

    const coverLetter = `Dear Hiring Manager,

I am writing to express my strong interest in the position. With my background in ${highlightedTechnicalSkills}, I am confident that I would be a valuable addition to your team.

In my role at ${employerName}, I ${primaryResponsibility}. This experience, combined with my ${highlightedBusinessSkill}, has prepared me well for this opportunity.

I am particularly drawn to this position because of [specific reason related to the job/company]. I am excited about the possibility of contributing to your team and growing professionally within your organization.

Thank you for considering my application. I look forward to discussing how my skills and experience align with your needs.

Sincerely,
${fullName}`;

    return coverLetter;
  }
}

// Singleton instance
let playwrightService: PlaywrightApplicationService | null = null;

export const getPlaywrightService = (): PlaywrightApplicationService => {
  if (!playwrightService) {
    playwrightService = new PlaywrightApplicationService();
  }
  return playwrightService;
};