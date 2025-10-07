// components/JobCard.tsx
import { JobOpportunity } from '@/types';

interface JobCardProps {
  job: JobOpportunity;
  onApprove: () => void;
  onReject: () => void;
}

export const JobCard = ({ job, onApprove, onReject }: JobCardProps) => {
  return (
    <div className="flex justify-center">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm w-full max-w-2xl overflow-hidden">
        <div className="p-5">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{job.title}</h3>
              <p className="text-gray-600">{job.company} • {job.location}</p>
            </div>
            {job.salary && (
              <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                {job.salary}
              </span>
            )}
          </div>
          
          <div className="mt-4">
            <p className="text-sm text-gray-600 line-clamp-3">{job.description}</p>
          </div>
          
          <div className="mt-4 flex flex-wrap gap-2">
            {job.skills?.map((skill, index) => (
              <span 
                key={index}
                className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded"
              >
                {skill}
              </span>
            ))}
          </div>
          
          <div className="mt-6 flex space-x-3">
            <button
              onClick={onApprove}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
            >
              Apply Now
            </button>
            <button
              onClick={onReject}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition duration-200"
            >
              Not Interested
            </button>
          </div>
        </div>
        
        {job.application_url && (
          <div className="bg-gray-50 px-5 py-3 border-t border-gray-200">
            <a 
              href={job.application_url} 
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              View Original Job Post
            </a>
          </div>
        )}
      </div>
    </div>
  );
};