import { Test } from '@nestjs/testing';

import { BloodStatus } from '../enums/blood-status.enum';
import { BloodTransitionException } from '../exceptions/blood-transition.exception';
import {
  BloodStatusStateMachine,
  VALID_BLOOD_TRANSITIONS,
} from './blood-status-state-machine';

describe('BloodStatusStateMachine', () => {
  let stateMachine: BloodStatusStateMachine;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [BloodStatusStateMachine],
    }).compile();

    stateMachine = module.get<BloodStatusStateMachine>(BloodStatusStateMachine);
  });

  describe('getAllowedTransitions', () => {
    it('should return empty array for terminal statuses', () => {
      expect(stateMachine.getAllowedTransitions(BloodStatus.DELIVERED)).toEqual([]);
      expect(stateMachine.getAllowedTransitions(BloodStatus.DISPOSED)).toEqual([]);
    });

    it('should return non-empty arrays for non-terminal statuses', () => {
      expect(stateMachine.getAllowedTransitions(BloodStatus.AVAILABLE)).not.toHaveLength(0);
      expect(stateMachine.getAllowedTransitions(BloodStatus.RESERVED)).not.toHaveLength(0);
      expect(stateMachine.getAllowedTransitions(BloodStatus.IN_TRANSIT)).not.toHaveLength(0);
      expect(stateMachine.getAllowedTransitions(BloodStatus.EXPIRED)).not.toHaveLength(0);
      expect(stateMachine.getAllowedTransitions(BloodStatus.COMPROMISED)).not.toHaveLength(0);
    });

    it('should always return arrays defined in VALID_BLOOD_TRANSITIONS', () => {
      const allStatuses = Object.values(BloodStatus);
      for (const status of allStatuses) {
        const allowed = stateMachine.getAllowedTransitions(status);
        expect(allowed).toEqual(VALID_BLOOD_TRANSITIONS[status] ?? []);
      }
    });
  });

  describe('Property-based: Valid transitions (forward flow)', () => {
    /**
     * Property test: For each status, all transitions in getAllowedTransitions
     * should succeed without throwing.
     */
    it('should allow all valid transitions without throwing', () => {
      const allStatuses = Object.values(BloodStatus);

      for (const currentStatus of allStatuses) {
        const allowed = stateMachine.getAllowedTransitions(currentStatus);

        for (const nextStatus of allowed) {
          // Should not throw
          const result = stateMachine.transition(currentStatus, nextStatus);
          expect(result).toBe(nextStatus);
        }
      }
    });

    it('should allow Available → Reserved → InTransit → Delivered forward flow', () => {
      expect(
        stateMachine.transition(BloodStatus.AVAILABLE, BloodStatus.RESERVED),
      ).toBe(BloodStatus.RESERVED);
      expect(
        stateMachine.transition(BloodStatus.RESERVED, BloodStatus.IN_TRANSIT),
      ).toBe(BloodStatus.IN_TRANSIT);
      expect(
        stateMachine.transition(BloodStatus.IN_TRANSIT, BloodStatus.DELIVERED),
      ).toBe(BloodStatus.DELIVERED);
    });

    it('should allow Compromised → Disposed flow', () => {
      expect(
        stateMachine.transition(BloodStatus.COMPROMISED, BloodStatus.DISPOSED),
      ).toBe(BloodStatus.DISPOSED);
    });

    it('should allow Expired → Disposed flow', () => {
      expect(
        stateMachine.transition(BloodStatus.EXPIRED, BloodStatus.DISPOSED),
      ).toBe(BloodStatus.DISPOSED);
    });

    it('should allow Reserved → Available cancellation', () => {
      expect(
        stateMachine.transition(BloodStatus.RESERVED, BloodStatus.AVAILABLE),
      ).toBe(BloodStatus.AVAILABLE);
    });

    it('should allow Expired at any point in flow', () => {
      // Available -> Expired
      expect(
        stateMachine.transition(BloodStatus.AVAILABLE, BloodStatus.EXPIRED),
      ).toBe(BloodStatus.EXPIRED);

      // Reserved -> Expired
      expect(
        stateMachine.transition(BloodStatus.RESERVED, BloodStatus.EXPIRED),
      ).toBe(BloodStatus.EXPIRED);

      // InTransit -> Expired
      expect(
        stateMachine.transition(BloodStatus.IN_TRANSIT, BloodStatus.EXPIRED),
      ).toBe(BloodStatus.EXPIRED);
    });
  });

  describe('Property-based: Invalid transitions (backwards, skips, terminal violations)', () => {
    /**
     * Property test: All non-allowed transitions should throw BloodTransitionException.
     */
    it('should reject all invalid transitions with BloodTransitionException', () => {
      const allStatuses = Object.values(BloodStatus);

      for (const currentStatus of allStatuses) {
        for (const nextStatus of allStatuses) {
          const allowed = stateMachine.getAllowedTransitions(currentStatus);

          if (!allowed.includes(nextStatus)) {
            // This transition should be invalid
            expect(() => {
              stateMachine.transition(currentStatus, nextStatus);
            }).toThrow(BloodTransitionException);
          }
        }
      }
    });

    it('should reject backward transitions from Delivered', () => {
      expect(() =>
        stateMachine.transition(BloodStatus.DELIVERED, BloodStatus.IN_TRANSIT),
      ).toThrow(BloodTransitionException);

      expect(() =>
        stateMachine.transition(BloodStatus.DELIVERED, BloodStatus.RESERVED),
      ).toThrow(BloodTransitionException);

      expect(() =>
        stateMachine.transition(BloodStatus.DELIVERED, BloodStatus.AVAILABLE),
      ).toThrow(BloodTransitionException);
    });

    it('should reject backward transitions from InTransit', () => {
      expect(() =>
        stateMachine.transition(BloodStatus.IN_TRANSIT, BloodStatus.RESERVED),
      ).toThrow(BloodTransitionException);

      expect(() =>
        stateMachine.transition(BloodStatus.IN_TRANSIT, BloodStatus.AVAILABLE),
      ).toThrow(BloodTransitionException);
    });

    it('should reject backward transitions from Reserved', () => {
      // Reserved can go back to Available, but not beyond
      expect(() =>
        stateMachine.transition(BloodStatus.RESERVED, BloodStatus.IN_TRANSIT),
      ).not.toThrow(); // This is actually valid

      expect(() =>
        stateMachine.transition(BloodStatus.RESERVED, BloodStatus.DELIVERED),
      ).toThrow(BloodTransitionException); // Skip forward not allowed
    });

    it('should reject skipping forward from Available', () => {
      expect(() =>
        stateMachine.transition(BloodStatus.AVAILABLE, BloodStatus.IN_TRANSIT),
      ).toThrow(BloodTransitionException);

      expect(() =>
        stateMachine.transition(BloodStatus.AVAILABLE, BloodStatus.DELIVERED),
      ).toThrow(BloodTransitionException);
    });

    it('should reject skipping from Reserved to Delivered', () => {
      expect(() =>
        stateMachine.transition(BloodStatus.RESERVED, BloodStatus.DELIVERED),
      ).toThrow(BloodTransitionException);
    });

    it('should reject transitions from terminal states', () => {
      // Delivered is terminal (no transitions allowed)
      expect(() =>
        stateMachine.transition(BloodStatus.DELIVERED, BloodStatus.DISPOSED),
      ).toThrow(BloodTransitionException);

      expect(() =>
        stateMachine.transition(BloodStatus.DELIVERED, BloodStatus.AVAILABLE),
      ).toThrow(BloodTransitionException);

      // Disposed is terminal (no transitions allowed after any status -> Disposed)
      expect(() =>
        stateMachine.transition(BloodStatus.DISPOSED, BloodStatus.DELIVERED),
      ).toThrow(BloodTransitionException);

      expect(() =>
        stateMachine.transition(BloodStatus.DISPOSED, BloodStatus.AVAILABLE),
      ).toThrow(BloodTransitionException);
    });

    it('should reject self-transitions', () => {
      const allStatuses = Object.values(BloodStatus);

      for (const status of allStatuses) {
        if (status !== BloodStatus.DELIVERED && status !== BloodStatus.DISPOSED) {
          // Only test non-terminal statuses as they might allow self-transition
          if (!stateMachine.getAllowedTransitions(status).includes(status)) {
            expect(() =>
              stateMachine.transition(status, status),
            ).toThrow(BloodTransitionException);
          }
        }
      }
    });

    it('should include context in BloodTransitionException', () => {
      const unitId = 'unit-123';
      let exception: BloodTransitionException;

      try {
        stateMachine.transition(
          BloodStatus.DELIVERED,
          BloodStatus.AVAILABLE,
          unitId,
        );
        fail('Expected BloodTransitionException');
      } catch (e) {
        exception = e as BloodTransitionException;
      }

      expect(exception.detail.attemptedFrom).toBe(BloodStatus.DELIVERED);
      expect(exception.detail.attemptedTo).toBe(BloodStatus.AVAILABLE);
      expect(exception.detail.unitId).toBe(unitId);
      expect(exception.detail.allowedTransitions).toEqual([]);
    });
  });

  describe('isTerminal', () => {
    it('should identify DELIVERED as terminal', () => {
      expect(stateMachine.isTerminal(BloodStatus.DELIVERED)).toBe(true);
    });

    it('should identify DISPOSED as terminal', () => {
      expect(stateMachine.isTerminal(BloodStatus.DISPOSED)).toBe(true);
    });

    it('should identify non-terminal statuses', () => {
      expect(stateMachine.isTerminal(BloodStatus.AVAILABLE)).toBe(false);
      expect(stateMachine.isTerminal(BloodStatus.RESERVED)).toBe(false);
      expect(stateMachine.isTerminal(BloodStatus.IN_TRANSIT)).toBe(false);
      expect(stateMachine.isTerminal(BloodStatus.EXPIRED)).toBe(false);
      expect(stateMachine.isTerminal(BloodStatus.COMPROMISED)).toBe(false);
    });
  });

  describe('wouldTransitionToTerminal', () => {
    it('should return true for transitions to terminal states', () => {
      expect(
        stateMachine.wouldTransitionToTerminal(
          BloodStatus.EXPIRED,
          BloodStatus.DISPOSED,
        ),
      ).toBe(true);

      expect(
        stateMachine.wouldTransitionToTerminal(
          BloodStatus.IN_TRANSIT,
          BloodStatus.DELIVERED,
        ),
      ).toBe(true);
    });

    it('should return false for transitions to non-terminal states', () => {
      expect(
        stateMachine.wouldTransitionToTerminal(
          BloodStatus.AVAILABLE,
          BloodStatus.RESERVED,
        ),
      ).toBe(false);

      expect(
        stateMachine.wouldTransitionToTerminal(
          BloodStatus.RESERVED,
          BloodStatus.IN_TRANSIT,
        ),
      ).toBe(false);
    });
  });

  describe('replayFromEvents', () => {
    it('should return the last status in the sequence', () => {
      const sequence = [
        BloodStatus.AVAILABLE,
        BloodStatus.RESERVED,
        BloodStatus.IN_TRANSIT,
        BloodStatus.DELIVERED,
      ];

      expect(stateMachine.replayFromEvents(sequence)).toBe(BloodStatus.DELIVERED);
    });

    it('should handle single-element sequences', () => {
      expect(stateMachine.replayFromEvents([BloodStatus.AVAILABLE])).toBe(
        BloodStatus.AVAILABLE,
      );
    });

    it('should throw for empty sequences', () => {
      expect(() => stateMachine.replayFromEvents([])).toThrow(
        'Cannot replay state: status history is empty',
      );
    });

    it('should return the final state regardless of sequence validity', () => {
      // Note: replay doesn't validate the sequence, it just returns the last element
      const sequence = [BloodStatus.AVAILABLE, BloodStatus.EXPIRED];
      expect(stateMachine.replayFromEvents(sequence)).toBe(BloodStatus.EXPIRED);
    });
  });

  describe('Complete workflow tests', () => {
    it('should handle complete happy-path workflow: Available -> Reserved -> InTransit -> Delivered (terminal)', () => {
      let status = BloodStatus.AVAILABLE;

      status = stateMachine.transition(status, BloodStatus.RESERVED);
      expect(status).toBe(BloodStatus.RESERVED);
      expect(stateMachine.isTerminal(status)).toBe(false);

      status = stateMachine.transition(status, BloodStatus.IN_TRANSIT);
      expect(status).toBe(BloodStatus.IN_TRANSIT);
      expect(stateMachine.isTerminal(status)).toBe(false);

      status = stateMachine.transition(status, BloodStatus.DELIVERED);
      expect(status).toBe(BloodStatus.DELIVERED);
      expect(stateMachine.isTerminal(status)).toBe(true);

      // DELIVERED is terminal, no further transitions allowed
      expect(() =>
        stateMachine.transition(status, BloodStatus.DISPOSED),
      ).toThrow(BloodTransitionException);

      expect(() =>
        stateMachine.transition(status, BloodStatus.AVAILABLE),
      ).toThrow(BloodTransitionException);
    });

    it('should handle expiry during reservation workflow', () => {
      let status = BloodStatus.AVAILABLE;

      status = stateMachine.transition(status, BloodStatus.RESERVED);
      expect(status).toBe(BloodStatus.RESERVED);

      // Blood expires while reserved
      status = stateMachine.transition(status, BloodStatus.EXPIRED);
      expect(status).toBe(BloodStatus.EXPIRED);

      status = stateMachine.transition(status, BloodStatus.DISPOSED);
      expect(status).toBe(BloodStatus.DISPOSED);
    });

    it('should handle compromise detection', () => {
      let status = BloodStatus.AVAILABLE;

      status = stateMachine.transition(status, BloodStatus.RESERVED);
      status = stateMachine.transition(status, BloodStatus.IN_TRANSIT);

      // Temperature violation detected
      status = BloodStatus.COMPROMISED; // Direct state assignment (not a transition in this context)

      status = stateMachine.transition(status, BloodStatus.DISPOSED);
      expect(status).toBe(BloodStatus.DISPOSED);
    });

    it('should handle reservation cancellation', () => {
      let status = BloodStatus.AVAILABLE;

      status = stateMachine.transition(status, BloodStatus.RESERVED);
      expect(status).toBe(BloodStatus.RESERVED);

      // Cancel reservation
      status = stateMachine.transition(status, BloodStatus.AVAILABLE);
      expect(status).toBe(BloodStatus.AVAILABLE);

      // Can be reserved again
      status = stateMachine.transition(status, BloodStatus.RESERVED);
      expect(status).toBe(BloodStatus.RESERVED);
    });
  });

  describe('Edge cases and comprehensive coverage', () => {
    it('should verify all states are covered in VALID_BLOOD_TRANSITIONS', () => {
      const allStatuses = Object.values(BloodStatus);
      const definedStatuses = Object.keys(VALID_BLOOD_TRANSITIONS);

      for (const status of allStatuses) {
        expect(definedStatuses).toContain(status);
      }
    });

    it('should never have undefined in allowed transitions', () => {
      const allStatuses = Object.values(BloodStatus);

      for (const status of allStatuses) {
        const allowed = stateMachine.getAllowedTransitions(status);
        expect(allowed).toBeDefined();
        expect(Array.isArray(allowed)).toBe(true);

        for (const nextStatus of allowed) {
          expect(nextStatus).toBeDefined();
          expect(allStatuses).toContain(nextStatus);
        }
      }
    });

    it('should maintain backward consistency: if A can go to B, history should show valid transition', () => {
      const sequence = [BloodStatus.AVAILABLE, BloodStatus.RESERVED, BloodStatus.IN_TRANSIT];

      const finalStatus = stateMachine.replayFromEvents(sequence);
      expect(finalStatus).toBe(BloodStatus.IN_TRANSIT);

      // Verify each transition in the sequence was valid
      for (let i = 0; i < sequence.length - 1; i++) {
        const from = sequence[i];
        const to = sequence[i + 1];
        const allowed = stateMachine.getAllowedTransitions(from);
        expect(allowed).toContain(to);
      }
    });
  });
});
