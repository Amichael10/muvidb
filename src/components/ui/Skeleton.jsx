import React from 'react';

const Skeleton = ({ className, ...props }) => {
  return (
    <div
      className={`animate-pulse rounded-md bg-surface-2/20 ${className}`}
      {...props}
    />
  );
};

export { Skeleton };
export default Skeleton;
