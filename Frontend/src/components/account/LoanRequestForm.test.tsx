import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoanRequestForm } from './LoanRequestForm';

function renderLoanForm(amount = '10000') {
  const events: { submitted: boolean; cancelled: boolean } = { submitted: false, cancelled: false };
  const markup = renderToStaticMarkup(
    React.createElement(LoanRequestForm, {
      amount,
      purpose: 'Inventory purchase',
      repaymentPeriod: '12',
      submitting: false,
      onAmountChange: () => undefined,
      onPurposeChange: () => undefined,
      onRepaymentPeriodChange: () => undefined,
      onSubmit: () => Object.assign(events, { submitted: true }),
      onCancel: () => Object.assign(events, { cancelled: true }),
    })
  );
  return { markup, events };
}

function requiredPropsMarkup() {
  const { markup } = renderLoanForm('');
  return markup;
}

describe('LoanRequestForm - loan terms display', () => {
  it('should always display the 0.1% loan interest rate', () => {
    const { markup } = renderLoanForm('');
    assert.ok(markup.includes('data-testid="loan-terms"'), 'terms section must render');
    assert.ok(markup.includes('Interest: 0.1%'), 'must show the 0.1% interest rate');
  });

  it('should always display the 1% per overdue day late penalty', () => {
    const { markup } = renderLoanForm('');
    assert.ok(markup.includes('Late repayment penalty: 1% per overdue day'));
  });

  it('should explain that penalties apply when the loan becomes overdue', () => {
    const { markup } = renderLoanForm('');
    assert.ok(markup.includes('becomes overdue'));
    assert.ok(markup.includes('after the repayment due date'));
  });

  it('should explain that penalties are additional and balance/day dependent', () => {
    // This explanation appears in the estimate detail section (requires valid amount)
    const { markup } = renderLoanForm('10000');
    assert.ok(markup.includes('Late penalties are additional charges'));
    assert.ok(markup.includes('number of overdue days'));
  });

  it('should explain the actual repayment allocation order (penalties, interest, principal)', () => {
    const { markup } = renderLoanForm('');
    assert.ok(markup.includes('applied first to penalties, then to interest, then to'));
  });

  it('should explain no compounding on penalties (matches backend rules)', () => {
    const { markup } = renderLoanForm('');
    assert.ok(markup.includes('does not compound and interest is never part of the penalty base'));
  });
});

describe('LoanRequestForm - live repayment estimate', () => {
  it('should show the full estimate breakdown for a 10,000 ETB loan', () => {
    const { markup } = renderLoanForm('10000');
    assert.ok(markup.includes('data-testid="loan-estimate"'));
    // Principal, interest (0.1%) and total before penalties per backend rules
    assert.ok(markup.includes('Requested principal'), 'must show principal row');
    assert.ok(markup.includes('10,000.00'), 'must show principal amount');
    assert.ok(markup.includes('Interest (0.1%, one-time)'), 'must label interest row');
    assert.ok(markup.includes('10.00'), 'must show 0.1% interest = 10');
    assert.ok(markup.includes('Total repayment before penalties'), 'must show pre-penalty total');
    assert.ok(markup.includes('10,010.00'), 'must show 10010 total before penalties');
  });

  it('should show the daily penalty indicator for the entered balance', () => {
    const { markup } = renderLoanForm('10000');
    assert.ok(markup.includes('1% per overdue day'), 'must show penalty rate');
    assert.ok(markup.includes('100.00'), 'must show ~100 per day on the entered balance');
    assert.ok(markup.includes('cannot be shown in advance'), 'must note penalties are excluded from the total');
  });

  it('should update the estimate when the principal changes', () => {
    const small = renderLoanForm('2000').markup;
    const large = renderLoanForm('20000').markup;
    // Small loan: 2000 + 0.1% = 2002 total, ~20/day penalty
    assert.ok(small.includes('2,000.00'));
    assert.ok(small.includes('2.00'));
    assert.ok(small.includes('2,002.00'));
    assert.ok(small.includes('20.00'));
    // Large loan: 20000 + 0.1% = 20020 total, ~200/day penalty
    assert.ok(large.includes('20,000.00'));
    assert.ok(large.includes('20.00'));
    assert.ok(large.includes('20,020.00'));
    assert.ok(large.includes('200.00'));
    assert.notEqual(small, large, 'estimate must differ between principals');
  });

  it('should show no estimated total for a missing amount', () => {
    const { markup } = renderLoanForm('');
    assert.ok(!markup.includes('NaN'), 'must never render NaN');
    assert.ok(markup.includes('Enter a valid amount above to see an estimated repayment breakdown'));
  });

  it('should handle invalid and malformed amounts safely', () => {
    for (const bad of ['abc', '-5', 'NaN', '   ']) {
      const { markup } = renderLoanForm(bad);
      // The input will show the raw string, but the ESTIMATE must show a safe fallback
      assert.ok(markup.includes('Enter a valid amount'), `must show safe fallback for "${bad}"`);
      assert.ok(!markup.includes('NaN') || markup.includes('value="NaN"'), `estimate must not show NaN as a number for "${bad}"`);
      assert.ok(!markup.includes('undefined'), `must not render undefined for "${bad}"`);
    }
  });
});

describe('LoanRequestForm - form integrity', () => {
  it('should keep the loan submission form functional', () => {
    const { markup } = renderLoanForm('1000');
    assert.ok(markup.includes('<form'), 'form element must exist');
    assert.ok(markup.includes('Loan Purpose'), 'purpose field must exist');
    // React renders maxLength as camelCase in server markup
    assert.ok(markup.includes('maxLength="500"'), 'purpose max length enforced');
    assert.ok(markup.includes('Repayment Period (months, optional)'), 'period field must exist');
    assert.ok(markup.includes('Submit Request'), 'submit button must exist');
    assert.ok(markup.includes('Cancel'), 'cancel button must exist');
  });

  it('should work on mobile and desktop (responsive layout classes present)', () => {
    const { markup } = renderLoanForm('10000');
    // Modal container: mobile padding + desktop padding, full width, capped height with scrolling
    assert.ok(markup.includes('max-w-md w-full'));
    assert.ok(markup.includes('max-h-[95vh] overflow-y-auto'));
    assert.ok(markup.includes('p-4 sm:p-6'));
    // Estimate and action rows reflow on small screens
    assert.ok(markup.includes('flex-col sm:flex-row'));
  });

  it('should present the loan terms outside any hidden/expandable disclosure', () => {
    const { markup, events } = renderLoanForm('10000');
    assert.ok(!markup.includes('<details'), 'terms must not be inside an expandable section');
    assert.ok(!markup.includes(' tooltip'), 'terms must not require a tooltip');
    assert.ok(events.submitted === false && events.cancelled === false, 'events must only fire on user interaction');
  });
});
