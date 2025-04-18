import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ScrollArea } from '../../../components/ui/scroll-area';

describe('ScrollArea Component', () => {
  it('renders ScrollArea with children', () => {
    const { getByText } = render(
      <ScrollArea>
        <div>Scrollable Content</div>
      </ScrollArea>
    );
    expect(getByText('Scrollable Content')).toBeInTheDocument();
  });
});
