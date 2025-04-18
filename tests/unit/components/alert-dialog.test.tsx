import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AlertDialog } from '../../../components/ui/alert-dialog';

describe('AlertDialog component', () => {
  it('renders children', () => {
    render(
      <AlertDialog open>
        <div>Dialog Content</div>
      </AlertDialog>
    );
    expect(screen.getByText('Dialog Content')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    render(
      <AlertDialog open={false}>
        <div>Should not be visible</div>
      </AlertDialog>
    );
    expect(screen.queryByText('Should not be visible')).toBeNull();
  });
});
