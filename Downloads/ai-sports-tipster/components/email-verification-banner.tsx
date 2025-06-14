import React from 'react';

export const EmailVerificationBanner: React.FC = () => {
  return (
    <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-4">
      <p className="text-yellow-700">
        Please verify your email address to access all features.
      </p>
    </div>
  );
}; 