import type { VedicHouseContext } from './llm/types';

export interface StructuredPayloadReportSection {
  title: string;
  subtitle?: string;
  rows: Array<{ label: string; value: string }>;
  emptyMessage?: string;
}

export function getStructuredPayloadReportSections(context: VedicHouseContext): StructuredPayloadReportSection[] {
  const natalStarName = context.natalJanmaStar?.nakshatra_name || 'Anuradha';
  const natalStarPada = context.natalJanmaStar?.pada || 2;
  const natalRashiName = context.natalJanmaStar?.rashi_name || 'Vrischigam';
  const sections: StructuredPayloadReportSection[] = [
    {
      title: '1. Tara Bala of Transiting Planets',
      subtitle: `From Janma Star: ${natalStarName} P${natalStarPada} · 9-Fold Parashara Count`,
      rows: (context.taraBalaTransitPlanets || []).map(item => ({
        label: `${item.graha_key} · ${item.taraName} (T${item.taraNumber}) · ${item.transit_star} P${item.pada}`,
        value: `${item.isAuspicious ? 'Auspicious' : item.taraNumber === 7 ? 'Cautionary' : 'Neutral'} · ${item.description}`
      })),
      emptyMessage: 'Standard Tara Bala mapped in prompt.'
    },
    {
      title: '2. Chandra Bala & Moon Progression',
      subtitle: `Janma Rashi: ${natalRashiName} · 2.25-Day Cycle`,
      rows: (context.chandraBalaDailyTimeline || []).map(item => ({
        label: `${item.dayRange} · Moon in ${item.moonSignName} (${item.moonStarName})`,
        value: `House ${item.houseFromNatalMoon} from Moon · ${item.isChandrashtama ? 'Chandrashtama' : item.isFavorable ? 'Favorable Chandra Bala' : 'Neutral/Obstruction'}${item.alertFlag && !item.isChandrashtama ? ' · Target House Transit' : ''}`
      })),
      emptyMessage: 'Full Moon 2.25-day cycle provided.'
    }
  ];

  if (context.ashtakavargaPayload) {
    sections.push({
      title: '3. Sarvashtakavarga (SAV) Bindus',
      subtitle: context.isComprehensiveMonthly || !context.houseNumber
        ? '12-House Distribution Overview · Parashara 337 Baseline'
        : `Target House ${context.houseNumber} = ${context.ashtakavargaPayload.targetHousePoints} Bindus [${context.ashtakavargaPayload.targetHouseStrength}] · Parashara 337 Baseline`,
      rows: context.ashtakavargaPayload.savPointsDistribution.map(item => ({
        label: `House ${item.houseNumber} · ${item.signName}`,
        value: `${item.points} Bindus · ${item.status}`
      }))
    });
  }

  if (context.dashaLordsDossier && context.dashaLordsDossier.length > 0) {
    sections.push({
      title: '4. Dasha Lords Karmic Dossier',
      subtitle: context.isComprehensiveMonthly || !context.houseNumber
        ? 'Vimshottari Triad Delivery · Rule 5'
        : `MD, AD, PD vs House ${context.houseNumber} · Rule 5`,
      rows: context.dashaLordsDossier.map(item => ({
        label: `${item.role} · ${item.lordName}`,
        value: `${item.functionalNature} · Lordship: ${item.ownedHousesTitle} · Natal: H${item.natalHouseOccupied} (${item.natalDignity}) · ${item.connectsToTargetHouse ? 'Connects to target' : 'No direct target link'}: ${item.targetConnectionReason}`
      }))
    });
  }

  if (context.bhavaKarakaInfo) {
    sections.push({
      title: '5. Bhava Sthira Karakas & Real-World Outlet Impacts',
      subtitle: context.isComprehensiveMonthly || !context.houseNumber ? 'Core Life Domains' : `House ${context.houseNumber}`,
      rows: [
        {
          label: 'Primary & Secondary Karakas',
          value: `${context.bhavaKarakaInfo.primaryKaraka} (Secondary: ${context.bhavaKarakaInfo.secondaryKarakas.join(', ')})`
        },
        { label: 'Significations', value: context.bhavaKarakaInfo.significations },
        { label: 'Concrete Physical Outlet', value: context.bhavaKarakaInfo.outletImpact }
      ]
    });
  }

  return sections;
}