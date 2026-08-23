// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AppButton } from './buttons/AppButton.js';
import { IconButton } from './buttons/IconButton.js';
import { ActionButton } from './buttons/ActionButton.js';
import { AppDialog } from './feedback/AppDialog.js';
import { AppDrawer } from './surfaces/AppDrawer.js';
import { AppTabs } from './navigation/AppTabs.js';
import { AppDropdown } from './navigation/AppDropdown.js';
import { NavigationItem } from './navigation/NavigationItem.js';
import { AppSelect } from './forms/AppSelect.js';
import { AppCheckbox } from './forms/AppCheckbox.js';
import { AppRadio } from './forms/AppRadio.js';

afterEach(() => {
  cleanup();
});

describe('Design System Interactive Components Unit & Interaction Tests', () => {
  describe('AppButton', () => {
    it('1. should invoke onClick callback when clicked', () => {
      const handleClick = vi.fn();
      render(<AppButton onClick={handleClick}>Submit Action</AppButton>);

      const btn = screen.getByRole('button', { name: /submit action/i });
      expect(btn.getAttribute('type')).toBe('button');
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('2. should NOT invoke onClick when disabled or loading', () => {
      const handleClick = vi.fn();
      const { rerender } = render(
        <AppButton disabled onClick={handleClick}>
          Disabled Action
        </AppButton>
      );

      const btn = screen.getByRole('button', { name: /disabled action/i });
      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();

      rerender(
        <AppButton isLoading onClick={handleClick}>
          Loading Action
        </AppButton>
      );
      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('3. should support explicit type="submit"', () => {
      render(<AppButton type="submit">Form Submit</AppButton>);
      const btn = screen.getByRole('button', { name: /form submit/i });
      expect(btn.getAttribute('type')).toBe('submit');
    });
  });

  describe('IconButton', () => {
    it('4. should render with aria-label, default type="button", and fire onClick', () => {
      const handleClick = vi.fn();
      render(
        <IconButton
          aria-label="Settings action"
          icon={<span data-testid="icon">⚙️</span>}
          onClick={handleClick}
        />
      );

      const btn = screen.getByRole('button', { name: /settings action/i });
      expect(btn.getAttribute('type')).toBe('button');
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('5. should not fire when disabled', () => {
      const handleClick = vi.fn();
      render(
        <IconButton
          disabled
          aria-label="Delete"
          icon={<span>🗑️</span>}
          onClick={handleClick}
        />
      );

      const btn = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('ActionButton', () => {
    it('6. should stop propagation when clicked inside a clickable row', () => {
      const handleRowClick = vi.fn();
      const handleActionClick = vi.fn();

      render(
        <div onClick={handleRowClick} data-testid="table-row">
          <ActionButton onClick={handleActionClick}>Row Action</ActionButton>
        </div>
      );

      const btn = screen.getByRole('button', { name: /row action/i });
      fireEvent.click(btn);

      expect(handleActionClick).toHaveBeenCalledTimes(1);
      expect(handleRowClick).not.toHaveBeenCalled();
    });
  });

  describe('AppTabs', () => {
    it('7. should switch active tab and call onChange on click and keyboard navigation', () => {
      const handleChange = vi.fn();
      const tabs = [
        { id: 'tab1', label: 'Overview' },
        { id: 'tab2', label: 'Details' },
        { id: 'tab3', label: 'Logs', disabled: true }
      ];

      render(<AppTabs tabs={tabs} activeTab="tab1" onChange={handleChange} />);

      const tab2 = screen.getByRole('tab', { name: /details/i });
      fireEvent.click(tab2);
      expect(handleChange).toHaveBeenCalledWith('tab2');

      const tab3 = screen.getByRole('tab', { name: /logs/i });
      fireEvent.click(tab3);
      expect(handleChange).not.toHaveBeenCalledWith('tab3');

      const tablist = screen.getByRole('tablist');
      fireEvent.keyDown(tablist, { key: 'ArrowRight' });
      expect(handleChange).toHaveBeenCalledWith('tab2');
    });
  });

  describe('AppDropdown', () => {
    it('8. should open on trigger click and invoke item callback on selection', () => {
      const handleItemClick = vi.fn();
      render(
        <AppDropdown
          trigger={<button>Options Menu</button>}
          items={[
            { id: '1', label: 'Edit', onClick: handleItemClick },
            { id: '2', label: 'Delete', onClick: vi.fn(), danger: true }
          ]}
        />
      );

      expect(screen.queryByRole('menu')).toBeNull();

      fireEvent.click(screen.getByText('Options Menu'));
      expect(screen.getByRole('menu')).not.toBeNull();

      const editBtn = screen.getByText('Edit');
      fireEvent.click(editBtn);
      expect(handleItemClick).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('menu')).toBeNull();
    });
  });

  describe('AppSelect', () => {
    it('9. should render label and call onChange on value selection', () => {
      const handleChange = vi.fn();
      render(
        <AppSelect
          label="Furnace Zone"
          value="Z1"
          onChange={handleChange}
          options={[
            { value: 'Z1', label: 'Zone 1 - Heating' },
            { value: 'Z2', label: 'Zone 2 - Soak' }
          ]}
        />
      );

      const select = screen.getByLabelText(/furnace zone/i);
      fireEvent.change(select, { target: { value: 'Z2' } });
      expect(handleChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('AppCheckbox and AppRadio', () => {
    it('10. should handle checkbox and radio state changes', () => {
      const handleCheckChange = vi.fn();
      const handleRadioChange = vi.fn();

      render(
        <div>
          <AppCheckbox label="Enable Pyrometry Alerts" checked={false} onChange={handleCheckChange} />
          <AppRadio label="AMS 2750G Standard" checked={false} onChange={handleRadioChange} />
        </div>
      );

      const chk = screen.getByLabelText(/enable pyrometry alerts/i);
      fireEvent.click(chk);
      expect(handleCheckChange).toHaveBeenCalledTimes(1);

      const rad = screen.getByLabelText(/ams 2750g standard/i);
      fireEvent.click(rad);
      expect(handleRadioChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('AppDialog', () => {
    it('11. should render modal when isOpen=true and trigger onClose on close button or Escape', () => {
      const handleClose = vi.fn();
      const { rerender } = render(
        <AppDialog isOpen={false} onClose={handleClose} title="Test Modal">
          <p>Modal content</p>
        </AppDialog>
      );

      expect(screen.queryByRole('dialog')).toBeNull();

      rerender(
        <AppDialog isOpen={true} onClose={handleClose} title="Test Modal">
          <p>Modal content</p>
        </AppDialog>
      );

      expect(screen.getByRole('dialog')).not.toBeNull();
      expect(screen.getByText('Test Modal')).not.toBeNull();

      const closeBtn = screen.getByRole('button', { name: /close dialog/i });
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(2);
    });
  });

  describe('AppDrawer', () => {
    it('12. should render drawer when isOpen=true and trigger onClose', () => {
      const handleClose = vi.fn();
      render(
        <AppDrawer isOpen={true} onClose={handleClose} title="Job Details">
          <p>Drawer content</p>
        </AppDrawer>
      );

      expect(screen.getByRole('dialog')).not.toBeNull();
      expect(screen.getByText('Job Details')).not.toBeNull();

      const closeBtn = screen.getByRole('button', { name: /close drawer/i });
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('NavigationItem', () => {
    it('13. should render navigation link with router and call onClick', () => {
      const handleClick = vi.fn();
      render(
        <BrowserRouter>
          <NavigationItem
            label="Furnaces"
            path="/machines"
            icon={<span>🔥</span>}
            onClick={handleClick}
          />
        </BrowserRouter>
      );

      const navLink = screen.getByText('Furnaces');
      fireEvent.click(navLink);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });
});
