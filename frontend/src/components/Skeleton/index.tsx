import type { CSSProperties } from "react";
import "./Skeleton.css";

type SkeletonProps = {
  className?: string;
  style?: CSSProperties;
};

export default function Skeleton({ className = "", style }: SkeletonProps) {
  return <div className={`skeleton ${className}`.trim()} style={style} aria-hidden="true" />;
}