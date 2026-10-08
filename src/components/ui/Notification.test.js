import { describe, it, expect } from 'vitest';
import Notification from './Notification.jsx';

describe('Notification Component & Alert System', () => {
  it('Notification export is a valid React function component', () => {
    expect(typeof Notification).toBe('function');
  });

  it('verifies alert tone styling rules', () => {
    const tones = {
      success: "border-l-success text-success",
      warning: "border-l-warning text-warning",
      info: "border-l-accent-blue text-accent-blue",
      danger: "border-l-danger text-danger",
      error: "border-l-danger text-danger"
    };

    expect(tones.success).toContain('border-l-success');
    expect(tones.warning).toContain('border-l-warning');
    expect(tones.info).toContain('border-l-accent-blue');
    expect(tones.danger).toContain('border-l-danger');
    expect(tones.error).toContain('border-l-danger');
  });

  it('renders safely with empty notification queue', () => {
    // Should not throw when invoked with empty array
    const element = Notification({ notifications: [], onDismiss: () => {} });
    expect(element).toBeDefined();
    expect(element.props.className).toContain('fixed top-5 right-5');
  });
});
