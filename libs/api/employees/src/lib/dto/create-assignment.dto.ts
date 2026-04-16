import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsUUID,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'EffectiveToAfterFrom', async: false })
class EffectiveToAfterFromConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as {
      effective_from?: string;
      effective_to?: string;
    };
    if (!dto.effective_to) return true;
    if (!dto.effective_from) return true;
    return new Date(dto.effective_to) > new Date(dto.effective_from);
  }
  defaultMessage(): string {
    return 'effective_to must be after effective_from';
  }
}

export class CreateAssignmentDto {
  @IsUUID()
  branch_id!: string;

  @IsIn(['secondary', 'temporary'], {
    message:
      'assignment_type must be secondary or temporary (primary is set via Employee.primary_branch_id)',
  })
  assignment_type!: 'secondary' | 'temporary';

  @IsISO8601({ strict: true })
  effective_from!: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Validate(EffectiveToAfterFromConstraint)
  effective_to?: string;
}
