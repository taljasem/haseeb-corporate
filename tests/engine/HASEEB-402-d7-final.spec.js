import { describe, it, expect } from 'vitest';
import * as legacy from '../../src/api/budgets-legacy';
import * as engine from '../../src/engine';

describe('HASEEB-402 D7 FINAL', () => {
  it('budgets-legacy exports all 18 legacy names', () => {
    const expected = ['getActiveBudget','getActiveBudgetSummary','getAllBudgets','getBudgetById','getBudgetForYear','getBudgetVarianceByDepartment','getBudgetVarianceByLineItem','getBudgetWorkflowSummary','getBudgetLineComments','createBudgetLine','updateBudgetLine','deleteBudgetLine','addBudgetLineComment','deleteBudgetLineComment','updateBudgetLineItemValue','approveBudget','delegateBudget','submitDepartment','getTeamMembers'];
    for (const n of expected) {
      expect(typeof legacy[n], `legacy.${n} must be a function`).toBe('function');
    }
  });
  it('engine surface does NOT export the 18 legacy names', () => {
    const deleted = ['getActiveBudget','getActiveBudgetSummary','getAllBudgets','getBudgetById','getBudgetForYear','getBudgetVarianceByDepartment','getBudgetVarianceByLineItem','getBudgetWorkflowSummary','getBudgetLineComments','createBudgetLine','updateBudgetLine','deleteBudgetLine','addBudgetLineComment','deleteBudgetLineComment','updateBudgetLineItemValue','approveBudget','delegateBudget','submitDepartment','getTeamMembers'];
    for (const n of deleted) {
      expect(engine[n], `engine.${n} must be deleted`).toBeUndefined();
    }
  });
  it('9 residual names are now wired in engine', () => {
    const wired = ['getOwnerTopInsightDynamic','searchChartOfAccounts','checkPeriodStatus','updateExchangeRates','attachJEFile','removeJEAttachment','getJEAttachments','shareJETemplate','getFiscalYearConfig'];
    for (const n of wired) {
      expect(typeof engine[n], `engine.${n} must be a function`).toBe('function');
    }
  });
});
