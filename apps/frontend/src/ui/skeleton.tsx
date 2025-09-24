import React from "react";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  lines?: number;   // optional helper for stacked rows
  lineClassName?: string;
};

export default function Skeleton({ className = "", lines, lineClassName = "" , ...rest}: Props) {
  if (lines && lines > 1) {
    return (
      <div className={className} {...rest}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`h-4 w-full bg-gray-100 rounded mb-2 last:mb-0 animate-pulse ${lineClassName}`}
          />
        ))}
      </div>
    );
  }
  return (
    <div
      className={`bg-gray-100 rounded animate-pulse ${className}`}
      {...rest}
    />
  );
}
