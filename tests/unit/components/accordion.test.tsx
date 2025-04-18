import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../../../components/ui/accordion';

describe('Accordion component', () => {
  it('renders children', async () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Section 1</AccordionTrigger>
          <AccordionContent>Content 1</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    expect(screen.getByText('Section 1')).toBeInTheDocument();
    // Open the accordion to reveal content
    await userEvent.click(screen.getByText('Section 1'));
    expect(screen.getByText('Content 1')).toBeVisible();
  });

  it('toggles content on trigger click', async () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Section 1</AccordionTrigger>
          <AccordionContent>Content 1</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    const trigger = screen.getByText('Section 1');
    // Open
    await userEvent.click(trigger);
    expect(screen.getByText('Content 1')).toBeVisible();
    // Close
    await userEvent.click(trigger);
    expect(screen.queryByText('Content 1')).toBeNull();
  });
});
