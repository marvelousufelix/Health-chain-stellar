import { BadRequestException } from '@nestjs/common';

import { BloodStatus } from '../enums/blood-status.enum';

export interface BloodTransitionErrorDetail {
  attemptedFrom: BloodStatus;
  attemptedTo: BloodStatus;
  allowedTransitions: BloodStatus[];
  unitId?: string;
}

/**
 * Thrown whenever a caller attempts an illegal blood unit state transition.
 * The response body always includes the attempted transition and the
 * list of transitions that would have been valid.
 */
export class BloodTransitionException extends BadRequestException {
  public readonly detail: BloodTransitionErrorDetail;

  constructor(detail: BloodTransitionErrorDetail) {
    super({
      message: `Invalid blood unit status transition from '${detail.attemptedFrom}' to '${detail.attemptedTo}'${detail.unitId ? ` for unit ${detail.unitId}` : ''}`,
      error: 'BloodTransitionException',
      attemptedFrom: detail.attemptedFrom,
      attemptedTo: detail.attemptedTo,
      allowedTransitions: detail.allowedTransitions,
      unitId: detail.unitId,
    });
    this.detail = detail;
  }
}
