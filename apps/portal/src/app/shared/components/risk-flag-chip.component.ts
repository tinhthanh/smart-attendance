import { Component, computed, input } from '@angular/core';
import {
  IonChip,
  IonContent,
  IonIcon,
  IonLabel,
  IonPopover,
  IonText,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  flashOutline,
  helpCircleOutline,
  helpOutline,
  locationOutline,
  navigateCircleOutline,
  shieldCheckmarkOutline,
  shieldHalfOutline,
  warningOutline,
  wifiOutline,
} from 'ionicons/icons';
import { getRiskFlagInfo } from '@smart-attendance/shared/constants';

addIcons({
  'alert-circle-outline': alertCircleOutline,
  'flash-outline': flashOutline,
  'help-circle-outline': helpCircleOutline,
  'help-outline': helpOutline,
  'location-outline': locationOutline,
  'navigate-circle-outline': navigateCircleOutline,
  'shield-checkmark-outline': shieldCheckmarkOutline,
  'shield-half-outline': shieldHalfOutline,
  'warning-outline': warningOutline,
  'wifi-outline': wifiOutline,
});

@Component({
  selector: 'app-risk-flag-chip',
  standalone: true,
  imports: [IonChip, IonIcon, IonLabel, IonPopover, IonContent, IonText],
  template: `
    <ion-chip [color]="info().severity" [id]="popId" button="true">
      <ion-icon [name]="info().icon" aria-hidden="true"></ion-icon>
      <ion-label>{{ info().label_vi }}</ion-label>
    </ion-chip>
    <ion-popover [trigger]="popId" triggerAction="hover" side="top">
      <ng-template>
        <ion-content class="ion-padding">
          <ion-text>{{ info().description_vi }}</ion-text>
        </ion-content>
      </ng-template>
    </ion-popover>
  `,
  styles: [
    `
      :host {
        display: inline-block;
      }
      ion-popover {
        --width: 260px;
      }
    `,
  ],
})
export class RiskFlagChipComponent {
  readonly flag = input.required<string>();
  readonly info = computed(() => getRiskFlagInfo(this.flag()));
  readonly popId = `rfc-${Math.random().toString(36).slice(2, 9)}`;
}
