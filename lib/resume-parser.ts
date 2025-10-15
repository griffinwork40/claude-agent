// lib/resume-parser.ts
// Purpose: Parse resume files (PDF, DOC, DOCX) and extract structured data

import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface ParsedResume {
  text: string;
  personalInfo: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
  };
  experience: Array<{
    title: string;
    company: string;
    duration: string;
    description: string;
  }>;
  skills: string[];
  education: Array<{
    degree: string;
    institution: string;
    year: string;
  }>;
  rawText: string;
}

export class ResumeParser {
  private static readonly SKILL_KEYWORDS = [
    // Programming Languages
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin',
    // Web Technologies
    'React', 'Vue', 'Angular', 'Node.js', 'Express', 'Next.js', 'Nuxt.js', 'Svelte', 'HTML', 'CSS', 'SASS', 'SCSS',
    // Databases
    'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch', 'SQLite', 'Oracle', 'SQL Server',
    // Cloud & DevOps
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'Jenkins', 'CI/CD', 'Git', 'GitHub', 'GitLab',
    // Frameworks & Libraries
    'Django', 'Flask', 'Spring', 'Laravel', 'Rails', 'FastAPI', 'GraphQL', 'REST API', 'Microservices',
    // Tools & Platforms
    'Figma', 'Sketch', 'Adobe Creative Suite', 'Jira', 'Confluence', 'Slack', 'Trello', 'Asana',
    // Soft Skills
    'Leadership', 'Project Management', 'Team Collaboration', 'Communication', 'Problem Solving', 'Agile', 'Scrum'
  ];

  static async parseResume(filePath: string, fileName: string): Promise<ParsedResume> {
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    
    let text = '';
    
    try {
      switch (fileExtension) {
        case 'pdf':
          text = await this.parsePDF(filePath);
          break;
        case 'doc':
        case 'docx':
          text = await this.parseWord(filePath);
          break;
        case 'txt':
          text = readFileSync(filePath, 'utf-8');
          break;
        default:
          throw new Error(`Unsupported file type: ${fileExtension}`);
      }
    } catch (error) {
      console.error('Error parsing resume:', error);
      throw new Error(`Failed to parse resume: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return this.extractStructuredData(text, fileName);
  }

  private static async parsePDF(filePath: string): Promise<string> {
    const dataBuffer = readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  }

  private static async parseWord(filePath: string): Promise<string> {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  private static extractStructuredData(text: string, fileName: string): ParsedResume {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    return {
      text: text,
      personalInfo: this.extractPersonalInfo(lines),
      experience: this.extractExperience(lines),
      skills: this.extractSkills(text),
      education: this.extractEducation(lines),
      rawText: text
    };
  }

  private static extractPersonalInfo(lines: string[]): ParsedResume['personalInfo'] {
    const personalInfo: ParsedResume['personalInfo'] = {};
    
    // Email regex
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    // Phone regex (various formats)
    const phoneRegex = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
    // LinkedIn regex
    const linkedinRegex = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?/i;
    
    for (const line of lines) {
      // Extract email
      const emailMatch = line.match(emailRegex);
      if (emailMatch && !personalInfo.email) {
        personalInfo.email = emailMatch[0];
      }
      
      // Extract phone
      const phoneMatch = line.match(phoneRegex);
      if (phoneMatch && !personalInfo.phone) {
        personalInfo.phone = phoneMatch[0];
      }
      
      // Extract LinkedIn
      const linkedinMatch = line.match(linkedinRegex);
      if (linkedinMatch && !personalInfo.linkedin) {
        personalInfo.linkedin = linkedinMatch[0];
      }
      
      // Extract name (usually the first line or a line with only letters and spaces)
      if (!personalInfo.name && /^[A-Za-z\s\.]+$/.test(line) && line.length > 2 && line.length < 50) {
        personalInfo.name = line;
      }
      
      // Extract location (look for city, state patterns)
      if (!personalInfo.location && /^[A-Za-z\s,]+$/.test(line) && 
          (line.includes(',') || line.includes('City') || line.includes('State'))) {
        personalInfo.location = line;
      }
    }
    
    return personalInfo;
  }

  private static extractExperience(lines: string[]): ParsedResume['experience'] {
    const experience: ParsedResume['experience'] = [];
    const experienceKeywords = ['experience', 'employment', 'work history', 'career', 'professional'];
    
    let inExperienceSection = false;
    let currentJob: Partial<ParsedResume['experience'][0]> = {};
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lowerLine = line.toLowerCase();
      
      // Check if we're entering experience section
      if (experienceKeywords.some(keyword => lowerLine.includes(keyword))) {
        inExperienceSection = true;
        continue;
      }
      
      // Check if we're leaving experience section (education, skills, etc.)
      if (inExperienceSection && ['education', 'skills', 'certifications', 'projects'].some(keyword => 
          lowerLine.includes(keyword))) {
        if (currentJob.title) {
          experience.push(currentJob as ParsedResume['experience'][0]);
        }
        break;
      }
      
      if (inExperienceSection) {
        // Look for job title patterns
        if (this.isJobTitle(line)) {
          if (currentJob.title) {
            experience.push(currentJob as ParsedResume['experience'][0]);
          }
          currentJob = { title: line, company: '', duration: '', description: '' };
        }
        // Look for company patterns
        else if (currentJob.title && !currentJob.company && this.isCompanyName(line)) {
          currentJob.company = line;
        }
        // Look for duration patterns
        else if (currentJob.title && this.isDuration(line)) {
          currentJob.duration = line;
        }
        // Collect description
        else if (currentJob.title && line.length > 10) {
          currentJob.description += (currentJob.description ? ' ' : '') + line;
        }
      }
    }
    
    // Add the last job if exists
    if (currentJob.title) {
      experience.push(currentJob as ParsedResume['experience'][0]);
    }
    
    return experience;
  }

  private static extractSkills(text: string): string[] {
    const skills: string[] = [];
    const lowerText = text.toLowerCase();
    
    for (const skill of this.SKILL_KEYWORDS) {
      if (lowerText.includes(skill.toLowerCase())) {
        skills.push(skill);
      }
    }
    
    // Remove duplicates and return
    return [...new Set(skills)];
  }

  private static extractEducation(lines: string[]): ParsedResume['education'] {
    const education: ParsedResume['education'] = [];
    const educationKeywords = ['education', 'academic', 'university', 'college', 'degree'];
    
    let inEducationSection = false;
    let currentEducation: Partial<ParsedResume['education'][0]> = {};
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lowerLine = line.toLowerCase();
      
      // Check if we're entering education section
      if (educationKeywords.some(keyword => lowerLine.includes(keyword))) {
        inEducationSection = true;
        continue;
      }
      
      // Check if we're leaving education section
      if (inEducationSection && ['experience', 'skills', 'certifications', 'projects'].some(keyword => 
          lowerLine.includes(keyword))) {
        if (currentEducation.degree) {
          education.push(currentEducation as ParsedResume['education'][0]);
        }
        break;
      }
      
      if (inEducationSection) {
        // Look for degree patterns
        if (this.isDegree(line)) {
          if (currentEducation.degree) {
            education.push(currentEducation as ParsedResume['education'][0]);
          }
          currentEducation = { degree: line, institution: '', year: '' };
        }
        // Look for institution patterns
        else if (currentEducation.degree && !currentEducation.institution && this.isInstitution(line)) {
          currentEducation.institution = line;
        }
        // Look for year patterns
        else if (currentEducation.degree && this.isYear(line)) {
          currentEducation.year = line;
        }
      }
    }
    
    // Add the last education if exists
    if (currentEducation.degree) {
      education.push(currentEducation as ParsedResume['education'][0]);
    }
    
    return education;
  }

  private static isJobTitle(line: string): boolean {
    const titleKeywords = ['engineer', 'developer', 'manager', 'director', 'analyst', 'specialist', 'coordinator', 'lead', 'senior', 'junior'];
    return titleKeywords.some(keyword => line.toLowerCase().includes(keyword)) && line.length < 100;
  }

  private static isCompanyName(line: string): boolean {
    // Look for company indicators
    const companyIndicators = ['inc', 'llc', 'corp', 'ltd', 'company', 'technologies', 'solutions', 'systems'];
    return companyIndicators.some(indicator => line.toLowerCase().includes(indicator)) || 
           (line.length > 3 && line.length < 50 && !this.isDuration(line));
  }

  private static isDuration(line: string): boolean {
    // Look for date patterns
    const datePatterns = [
      /\d{4}\s*-\s*\d{4}/,  // 2020-2023
      /\d{4}\s*-\s*present/i,  // 2020-Present
      /\d{1,2}\/\d{4}\s*-\s*\d{1,2}\/\d{4}/,  // 01/2020-12/2023
      /\d{1,2}\/\d{4}\s*-\s*present/i,  // 01/2020-Present
      /jan\w*\s+\d{4}\s*-\s*dec\w*\s+\d{4}/i,  // January 2020 - December 2023
      /jan\w*\s+\d{4}\s*-\s*present/i  // January 2020 - Present
    ];
    
    return datePatterns.some(pattern => pattern.test(line));
  }

  private static isDegree(line: string): boolean {
    const degreeKeywords = ['bachelor', 'master', 'phd', 'doctorate', 'associate', 'certificate', 'diploma', 'degree'];
    return degreeKeywords.some(keyword => line.toLowerCase().includes(keyword));
  }

  private static isInstitution(line: string): boolean {
    const institutionKeywords = ['university', 'college', 'institute', 'school', 'academy'];
    return institutionKeywords.some(keyword => line.toLowerCase().includes(keyword)) && line.length > 5;
  }

  private static isYear(line: string): boolean {
    // Look for 4-digit years
    return /^\d{4}$/.test(line) && parseInt(line) >= 1950 && parseInt(line) <= new Date().getFullYear() + 5;
  }
}

export default ResumeParser;
