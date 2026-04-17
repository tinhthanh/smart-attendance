import { Component, Input, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import 'iconify-icon';

@Component({
  selector: 'app-sa-icon',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div
      class="icon-wrapper"
      [class]="variant"
      [style.--icon-size]="size + 'px'"
      [style.--icon-bg]="bgColor"
      [style.--icon-color]="color"
    >
      <iconify-icon
        [attr.icon]="icon"
        [attr.width]="iconSize"
        [attr.height]="iconSize"
      ></iconify-icon>
    </div>
  `,
  styles: [
    `
      .icon-wrapper {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 14px;
        transition: all 0.3s ease;
      }
      .icon-wrapper.rounded {
        width: var(--icon-size, 48px);
        height: var(--icon-size, 48px);
        background: var(--icon-bg, rgba(59, 130, 246, 0.1));
        color: var(--icon-color, #3b82f6);
      }
      .icon-wrapper.circle {
        width: var(--icon-size, 48px);
        height: var(--icon-size, 48px);
        background: var(--icon-bg, rgba(59, 130, 246, 0.1));
        color: var(--icon-color, #3b82f6);
        border-radius: 50%;
      }
      .icon-wrapper.plain {
        color: var(--icon-color, inherit);
      }
    `,
  ],
})
export class SaIconComponent {
  @Input() icon = 'solar:home-bold';
  @Input() size = 48;
  @Input() iconSize = 24;
  @Input() bgColor = 'rgba(59,130,246,0.1)';
  @Input() color = '#3b82f6';
  @Input() variant: 'rounded' | 'circle' | 'plain' = 'rounded';
}
