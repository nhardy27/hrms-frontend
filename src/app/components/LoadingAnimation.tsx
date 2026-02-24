import { useState, useEffect } from 'react';
import Lottie from 'lottie-react';

export function LoadingAnimation() {
  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    fetch('/Searching user profile.json')
      .then(res => res.json())
      .then(data => setAnimationData(data))
      .catch(() => setAnimationData(null));
  }, []);

  return (
    <div className="min-vh-100 d-flex justify-content-center align-items-center">
      <div className="text-center">
        {animationData ? (
          <Lottie 
            animationData={animationData}
            loop={true}
            style={{ width: 250, height: 250 }}
          />
        ) : (
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        )}
        <p className="mt-2">Loading...</p>
      </div>
    </div>
  );
}
