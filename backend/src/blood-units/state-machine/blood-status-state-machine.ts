import { Injectable } from '@nestjs/common';

import { BloodStatus } from '../enums/blood-status.enum';
import { BloodTransitionException } from '../exceptions/blood-transition.exception';

/**
 * Defines every legal edge in the blood unit lifecycle DAG.
 * Synchronized with the Soroban contract inventory blood unit FSM.
 *
 * Valid transitions follow this flow:
 * Available -> Reserved -> InTransit -> Delivered (terminal)
 *         \-> Expired (can happen at any stage)
 *         \-> Compromised (temperature violations trigger this)
 *
 * Terminal states (DELIVERED, DISPOSED) have an empty allowed-set.
 * EXPIRED and COMPROMISED can transition to DISPOSED.
 */
export const VALID_BLOOD_TRANSITIONS: Record<BloodStatus, BloodStatus[]> = {
  [BloodStatus.AVAILABLE]: [BloodStatus.RESERVED, BloodStatus.EXPIRED],
  [BloodStatus.RESERVED]: [
    BloodStatus.IN_TRANSIT,
    BloodStatus.AVAILABLE,
    BloodStatus.EXPIRED,
  ],
  [BloodStatus.IN_TRANSIT]: [BloodStatus.DELIVERED, BloodStatus.EXPIRED],
  [BloodStatus.DELIVERED]: [],
  [BloodStatus.EXPIRED]: [BloodStatus.DISPOSED],
  [BloodStatus.COMPROMISED]: [BloodStatus.DISPOSED],
  [BloodStatus.DISPOSED]: [],
};

/**
 * Centralized state machine for blood unit lifecycle transitions.
 * Ensures all blood unit status changes comply with the allowed transition rules.
 */
@Injectable()
export class BloodStatusStateMachine {
  /**
   * Returns all valid next statuses reachable from `currentStatus`.
   */
  getAllowedTransitions(currentStatus: BloodStatus): BloodStatus[] {
    return VALID_BLOOD_TRANSITIONS[currentStatus] ?? [];
  }

  /**
   * Validates the transition `currentStatus → nextStatus`.
   * Returns `nextStatus` when valid; throws `BloodTransitionException` otherwise.
   *
   * @param currentStatus The current blood unit status
   * @param nextStatus The desired next status
   * @param unitId Optional unit ID for error context
   * @returns The validated nextStatus
   * @throws BloodTransitionException if the transition is not allowed
   */
  transition(
    currentStatus: BloodStatus,
    nextStatus: BloodStatus,
    unitId?: string,
  ): BloodStatus {
    const allowed = this.getAllowedTransitions(currentStatus);

    if (!allowed.includes(nextStatus)) {
      throw new BloodTransitionException({
        attemptedFrom: currentStatus,
        attemptedTo: nextStatus,
        allowedTransitions: allowed,
        unitId,
      });
    }

    return nextStatus;
  }

  /**
   * Derives the current state by replaying an ordered sequence of statuses
   * (as recorded in the status history). The last element IS the current state.
   * Throws when the sequence is empty.
   *
   * @param orderedStatuses Ordered sequence of statuses from history
   * @returns The final status after replaying all transitions
   * @throws Error if the sequence is empty
   */
  replayFromEvents(orderedStatuses: BloodStatus[]): BloodStatus {
    if (orderedStatuses.length === 0) {
      throw new Error('Cannot replay state: status history is empty');
    }

    return orderedStatuses[orderedStatuses.length - 1];
  }

  /**
   * Check if a status is a terminal state (no further transitions allowed).
   * Terminal states: DELIVERED, DISPOSED
   */
  isTerminal(status: BloodStatus): boolean {
    return status === BloodStatus.DELIVERED || status === BloodStatus.DISPOSED;
  }

  /**
   * Check if a transition would result in a terminal state.
   */
  wouldTransitionToTerminal(currentStatus: BloodStatus, nextStatus: BloodStatus): boolean {
    return this.isTerminal(nextStatus);
  }
}
