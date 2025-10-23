/**
 * File: components/agents/chat/JobResultCard.tsx
 * Purpose: Beautiful job result card component with match percentage badges
 */

import { useState } from 'react';
import { JobOpportunity } from '@/types';

interface JobResultCardProps {
  job: JobOpportunity;
  expanded?: boolean;
  onToggleExpand?: (expanded: boolean) => void;
}

export function JobResultCard({ job, expanded, onToggleExpand }: JobResultCardProps) {
  const [isExpanded, setIsExpanded] = useState(expanded || false);
  
  const matchPercentage = job.match_percentage || 0;
  
  // Color-coded badge based on match percentage
  const matchBadgeClass = 
    matchPercentage >= 90 ? 'bg-green-500/20 text-green-400' :
    matchPercentage >= 85 ? 'bg-blue-500/20 text-blue-400' :
    'bg-[var(--muted)]/50 text-[var(--fg)]/70';
  
  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onToggleExpand?.(newExpanded);
  };
  
  return (
    <div 
      className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 
                 hover:border-[var(--border)]/70 transition-colors cursor-pointer group"
      onClick={handleToggle}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--fg)] truncate group-hover:text-[var(--fg)]/80">
            {job.title}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-xs text-[var(--fg)]/60">
            <span>💼 {job.company}</span>
            <span>•</span>
            <span>📍 {job.location}</span>
            {job.salary && (
              <>
                <span>•</span>
                <span>💰 {job.salary}</span>
              </>
            )}
          </div>
        </div>
        
        {/* Match Badge */}
        <div className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${matchBadgeClass}`}>
          {matchPercentage}% match
        </div>
      </div>
      
      {/* Expandable Highlights */}
      {isExpanded && job.skills && job.skills.length > 0 && (
        <div className="mt-3 pl-3 border-l-2 border-[var(--border)] animate-fadeIn">
          <div className="text-xs text-[var(--fg)]/60 mb-2 font-medium">Key Skills:</div>
          <ul className="space-y-1">
            {job.skills.slice(0, 5).map((skill, idx) => (
              <li key={idx} className="text-xs text-[var(--fg)]/70">
                • {skill}
              </li>
            ))}
            {job.skills.length > 5 && (
              <li className="text-xs text-[var(--fg)]/50">
                ... and {job.skills.length - 5} more
              </li>
            )}
          </ul>
        </div>
      )}
      
      {/* Job Description Preview */}
      {isExpanded && job.description && (
        <div className="mt-3 pl-3 border-l-2 border-[var(--border)] animate-fadeIn">
          <div className="text-xs text-[var(--fg)]/60 mb-2 font-medium">Description:</div>
          <p className="text-xs text-[var(--fg)]/70 line-clamp-3">
            {job.description}
          </p>
        </div>
      )}
      
      {/* Application URL */}
      {job.application_url && (
        <div className="mt-3 pt-2 border-t border-[var(--border)]/50">
          <a 
            href={job.application_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400/80 hover:text-blue-300/90 underline"
            onClick={(e) => e.stopPropagation()}
          >
            View Job Posting →
          </a>
        </div>
      )}
    </div>
  );
}
