import React from 'react';
import { AppButton, type AppButtonProps } from './AppButton.js';

export interface ActionButtonProps extends AppButtonProps {
  stopPropagation?: boolean;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  stopPropagation = true,
  onClick,
  ...props
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) {
      e.stopPropagation();
    }
    onClick?.(e);
  };

  return <AppButton onClick={handleClick} {...props} />;
};
