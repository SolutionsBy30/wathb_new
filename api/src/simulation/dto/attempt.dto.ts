import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class StartAttemptDto {
  @IsString() blueprintId!: string;
}

export class AnswerSimulationDto {
  @IsString() formItemId!: string;
  /** Null clears the answer — a student may unselect before the section locks. */
  @IsOptional() @IsString() @MaxLength(16) selectedKey?: string | null;
  /**
   * Client-reported time on this question. Only the browser can know it under
   * free navigation. The server clamps it to the section length and never lets
   * it touch the score — it colours the pacing report and nothing else.
   */
  @IsOptional() @IsInt() @Min(0) @Max(24 * 60 * 60 * 1000) timeSpentMs?: number;
}

export class FlagItemDto {
  @IsString() formItemId!: string;
  @IsBoolean() flagged!: boolean;
}

export class SimulationEventDto {
  // Whitelisted rather than free text: these rows are read back as counts on
  // the report (§7.2 screen exits), and an open string would let a client
  // invent event types that skew it.
  @IsIn(['focus_lost', 'focus_regained', 'resume', 'scratchpad_open', 'heartbeat']) type!: string;
}
