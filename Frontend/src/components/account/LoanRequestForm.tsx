import * as React from 'react'
import {
  Plus,
  FileText,
  CalendarDays,
  ShieldCheck,
  Percent,
  AlarmClock,
  Calculator,
} from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import {
  calculateLoanEstimate,
  parseLoanAmount,
} from '@/lib/loanTerms'

const formatETB = (amount: number) => formatCurrency(amount, 'ETB')

export interface LoanRequestFormProps {
  amount: string
  purpose: string
  repaymentPeriod: string
  submitting: boolean
  onAmountChange: (value: string) => void
  onPurposeChange: (value: string) => void
  onRepaymentPeriodChange: (value: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onCancel: () => void
}

export const LoanRequestForm = ({
  amount,
  purpose,
  repaymentPeriod,
  submitting,
  onAmountChange,
  onPurposeChange,
  onRepaymentPeriodChange,
  onSubmit,
  onCancel,
}: LoanRequestFormProps) => {
  // Display-only estimate mirroring the backend calculation rules
  // (Backend remains authoritative for the actual loan terms on approval)
  const estimate = parseLoanAmount(amount)
  const estimateResult = estimate !== null ? calculateLoanEstimate(estimate) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[95vh] overflow-y-auto p-4 sm:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-bold flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            New Loan Request
          </h3>
          <button
            onClick={onCancel}
            aria-label="Close loan request form"
            className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Amount Input */}
          <div className="space-y-2">
            <label htmlFor="loan-request-amount" className="text-sm font-bold text-muted-foreground flex items-center gap-1">
              <Calculator className="h-4 w-4" />
              Requested Amount <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                ETB
              </span>
              <Input
                id="loan-request-amount"
                type="number"
                name="amount"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                placeholder="0.00"
                className="pl-11 text-lg font-semibold"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">Minimum amount: ETB 1.00</p>
          </div>

          {/* Live Repayment Estimate (display-only, backend remains authoritative) */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4" data-testid="loan-estimate">
            <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1 mb-3">
              <Calculator className="h-3.5 w-3.5" />
              Estimated Repayment
            </p>
            {estimate !== null && estimateResult !== null ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3 flex-col sm:flex-row sm:items-baseline">
                  <span className="text-muted-foreground">Requested principal</span>
                  <span className="font-medium sm:ml-auto">{formatETB(estimateResult.principal)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 flex-col sm:flex-row sm:items-baseline">
                  <span className="text-muted-foreground">Interest (0.1%, one-time)</span>
                  <span className="font-medium text-info sm:ml-auto">{formatETB(estimateResult.interestAmount)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 flex-col sm:flex-row sm:items-baseline border-t border-primary/15 pt-2">
                  <span className="text-muted-foreground">Total repayment before penalties</span>
                  <span className="font-bold sm:ml-auto">{formatETB(estimateResult.totalBeforePenalties)}</span>
                </div>
                <div className="flex items-start justify-between gap-3 flex-col sm:flex-row">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Percent className="h-3.5 w-3.5 shrink-0" />
                    Late penalty rate
                  </span>
                  <span className="sm:ml-auto sm:text-right">
                    1% per overdue day <span className="text-muted-foreground">(≈ {formatETB(estimateResult.estimatedDailyPenalty)} / day on this balance)</span>
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                  Late penalties are additional charges on top of the total above. They depend on how much
                  remains unpaid when the loan becomes overdue and on the number of overdue days, so they
                  cannot be shown in advance.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Enter a valid amount above to see an estimated repayment breakdown.
              </p>
            )}
          </div>

          {/* Purpose Input */}
          <div className="space-y-2">
            <label htmlFor="loan-request-purpose" className="text-sm font-bold text-muted-foreground flex items-center gap-1">
              <FileText className="h-4 w-4" />
              Loan Purpose <span className="text-destructive">*</span>
            </label>
            <textarea
              id="loan-request-purpose"
              name="loanPurpose"
              value={purpose}
              onChange={(e) => onPurposeChange(e.target.value)}
              placeholder="e.g. Business expansion, inventory purchase, equipment upgrade..."
              rows={3}
              required
              maxLength={500}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
            />
            <p className="text-xs text-muted-foreground">{purpose.length}/500 characters</p>
          </div>

          {/* Repayment Period Input */}
          <div className="space-y-2">
            <label htmlFor="loan-request-period" className="text-sm font-bold text-muted-foreground flex items-center gap-1">
              <CalendarDays className="h-4 w-4" />
              Repayment Period (months, optional)
            </label>
            <Input
              id="loan-request-period"
              type="number"
              name="repaymentPeriod"
              min="1"
              max="120"
              value={repaymentPeriod}
              onChange={(e) => onRepaymentPeriodChange(e.target.value)}
              placeholder="e.g. 12"
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty if not specified (1-120 months). If provided, the repayment is due at the end of this term.
            </p>
          </div>

          {/* Loan Terms — always visible, not hidden in a tooltip/modal/expandable section */}
          <div className="rounded-xl border border-amber-300/50 bg-amber-50 p-4 space-y-2" data-testid="loan-terms">
            <p className="text-xs font-bold uppercase text-amber-800 flex items-center gap-1">
              <Percent className="h-3.5 w-3.5" />
              Loan Terms
            </p>
            <ul className="space-y-2 text-xs sm:text-sm text-foreground/80 leading-relaxed list-disc pl-4">
              <li>
                <span className="font-semibold">Interest: 0.1%</span> of the original principal, charged
                one time when the loan is approved.
              </li>
              <li>
                <span className="font-semibold">Late repayment penalty: 1% per overdue day</span> of the
                unpaid principal, charged after the repayment due date.
              </li>
              <li className="flex items-start gap-2 -ml-4 list-none">
                <AlarmClock className="h-3.5 w-3.5 shrink-0 mt-1 text-amber-700" />
                <span>
                  The late penalty applies only when a loan becomes overdue (past its due date) and only
                  on what remains unpaid — it does not compound and interest is never part of the penalty base.
                </span>
              </li>
              <li>
                When you make a repayment, it is applied first to penalties, then to interest, then to
                the principal.
              </li>
            </ul>
          </div>

          {/* Info Notice */}
          <div className="p-4 rounded-xl bg-info/10 border border-info/20 text-xs flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-info shrink-0 mt-0.5" />
            <span className="text-foreground/70 leading-relaxed">
              Submitting a loan request does not guarantee approval. All requests are reviewed by our team and the
              final amounts are calculated by our systems when the loan is approved.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 flex-col sm:flex-row">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              type="submit"
              isLoading={submitting}
            >
              <Plus className="h-4 w-4" />
              Submit Request
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LoanRequestForm
