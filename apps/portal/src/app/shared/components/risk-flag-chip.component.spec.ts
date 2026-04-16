import { TestBed } from '@angular/core/testing';
import { RiskFlagChipComponent } from './risk-flag-chip.component';

describe('RiskFlagChipComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RiskFlagChipComponent],
    }).compileComponents();
  });

  it('resolves known flag info', () => {
    const fixture = TestBed.createComponent(RiskFlagChipComponent);
    fixture.componentRef.setInput('flag', 'mock_location');
    fixture.detectChanges();
    expect(fixture.componentInstance.info().severity).toBe('danger');
    expect(fixture.componentInstance.info().label_vi).toBe('Giả lập vị trí');
  });

  it('falls back for unknown flag with raw string as label', () => {
    const fixture = TestBed.createComponent(RiskFlagChipComponent);
    fixture.componentRef.setInput('flag', 'new_flag_2027');
    fixture.detectChanges();
    expect(fixture.componentInstance.info().severity).toBe('info');
    expect(fixture.componentInstance.info().label_vi).toBe('new_flag_2027');
  });

  it('generates a stable popover id per instance', () => {
    const fixture = TestBed.createComponent(RiskFlagChipComponent);
    fixture.componentRef.setInput('flag', 'bssid_match');
    fixture.detectChanges();
    const id = fixture.componentInstance.popId;
    expect(id).toMatch(/^rfc-[a-z0-9]+$/);
    fixture.detectChanges();
    expect(fixture.componentInstance.popId).toBe(id);
  });
});
