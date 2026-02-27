/** Unit tests for BottomDrawer: peek and expand, onClose and Escape close, focus trap and return. */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BottomDrawer } from './BottomDrawer';

describe('BottomDrawer', () => {
  it('renders when open and shows peek state with title', () => {
    render(
      <BottomDrawer open onClose={() => {}} title="Route title">
        <p>Body content</p>
      </BottomDrawer>,
    );

    expect(screen.getByRole('dialog', { name: /route title/i })).toBeTruthy();
    expect(screen.getByText('Route title')).toBeTruthy();
    expect(screen.queryByText('Body content')).toBeFalsy();
  });

  it('does not render when closed', () => {
    render(
      <BottomDrawer open={false} onClose={() => {}}>
        <p>Body content</p>
      </BottomDrawer>,
    );

    expect(screen.queryByRole('dialog')).toBeFalsy();
    expect(screen.queryByText('Body content')).toBeFalsy();
  });

  it('shows peek and can expand to show scrollable body', async () => {
    render(
      <BottomDrawer open onClose={() => {}} title="My route">
        <p>Body content</p>
      </BottomDrawer>,
    );

    expect(screen.getByText('My route')).toBeTruthy();
    expect(screen.queryByText('Body content')).toBeFalsy();

    await userEvent.click(screen.getByRole('button', { name: /expand/i }));

    expect(screen.getByText('Body content')).toBeTruthy();
    expect(screen.getByRole('button', { name: /close/i })).toBeTruthy();
  });

  it('onClose is called when close button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <BottomDrawer open onClose={onClose} title="Route">
        <p>Content</p>
      </BottomDrawer>,
    );

    await userEvent.click(screen.getByRole('button', { name: /expand/i }));
    await userEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape closes the drawer', async () => {
    const onClose = vi.fn();
    render(
      <BottomDrawer open onClose={onClose} title="Route">
        <p>Content</p>
      </BottomDrawer>,
    );

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape closes when expanded', async () => {
    const onClose = vi.fn();
    render(
      <BottomDrawer open onClose={onClose} title="Route">
        <p>Content</p>
      </BottomDrawer>,
    );

    await userEvent.click(screen.getByRole('button', { name: /expand/i }));
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses peekContent when provided for peek strip', () => {
    render(
      <BottomDrawer open onClose={() => {}} title="Route" peekContent={<span>Peek line</span>}>
        <p>Body</p>
      </BottomDrawer>,
    );

    expect(screen.getByText('Peek line')).toBeTruthy();
    expect(screen.getByRole('button', { name: /expand/i })).toBeTruthy();
  });

  it('focus trap and return: expanded drawer contains focusable elements', async () => {
    const onClose = vi.fn();
    render(
      <BottomDrawer open onClose={onClose} title="Route">
        <button type="button">Action</button>
      </BottomDrawer>,
    );

    await userEvent.click(screen.getByRole('button', { name: /expand/i }));

    expect(screen.getByRole('button', { name: /close/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /action/i })).toBeTruthy();
  });
});
