"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface StaggeredListProps {
  children: React.ReactNode;
  className?: string;
  /** Delay before the first item animates (seconds) */
  initialDelay?: number;
  /** Delay between each item (seconds) */
  staggerDelay?: number;
  role?: string;
  "aria-label"?: string;
}

export function StaggeredList({
  children,
  className,
  initialDelay = 0,
  staggerDelay = 0.06,
  ...rest
}: StaggeredListProps) {
  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      animate="visible"
      {...rest}
      variants={{
        hidden: {},
        visible: {
          transition: {
            delayChildren: initialDelay,
            staggerChildren: staggerDelay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

interface StaggeredItemProps {
  children: React.ReactNode;
  className?: string;
}

export function StaggeredItem({ children, className }: StaggeredItemProps) {
  return (
    <motion.div
      className={cn(className)}
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.4,
            ease: [0.25, 1, 0.5, 1], // ease-out-quart
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
