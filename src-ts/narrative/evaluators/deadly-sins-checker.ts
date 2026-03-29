/**
 * Deadly Sins Checker
 *
 * Final quality gate checking seven deadly writing errors based on
 * the Ultimate Guide to AI Writing Agents.
 */

import {
  BaseEvaluator,
  EvaluationResult,
  Issue,
  Severity,
  ScoreLevel,
} from './base';

export enum DeadlySin {
  STRUCTURAL_DRIFT = 'structural_drift',
  EMOTIONAL_VACUUM = 'emotional_vacuum',
  NARRATIVE_STAGNATION = 'narrative_stagnation',
  APATHETIC_COWARD = 'apathetic_coward',
  AIMLESS_PLOTTING = 'aimless_plotting',
  FACELESS_NARRATION = 'faceless_narration',
  CHAOTIC_PRESENTATION = 'chaotic_presentation',
}

export interface SinCheckResult {
  sin: DeadlySin;
  nameCn: string;
  detected: boolean;
  severity: Severity;
  score: number;
  diagnosis: string;
  prescription: string;
  relatedSkill: string;
}

type SinInfo = {
  nameCn: string;
  skill: string;
  question: string;
};

export class DeadlySinsChecker extends BaseEvaluator {
  get name(): string {
    return 'deadly_sins_checker';
  }

  get description(): string {
    return '\u4e03\u4e2a\u81f4\u547d\u9519\u8bef\u68c0\u67e5\u5668 - \u5199\u4f5c\u8d28\u91cf\u7684\u6700\u7ec8\u9632\u7ebf';
  }

  private static readonly SIN_INFO: Readonly<Record<DeadlySin, SinInfo>> = {
    [DeadlySin.STRUCTURAL_DRIFT]: {
      nameCn: '\u7ed3\u6784\u6f02\u79fb',
      skill: 'pyramid-structure',
      question:
        '\u6838\u5fc3\u7ed3\u8bba\u662f\u5426\u5728\u5f00\u7bc7\u660e\u786e\uff1f\u8bba\u8bc1\u662f\u5426\u5728\u91d1\u5b57\u5854\u4e0a\u5c42\u5c42\u9012\u8fdb\uff1f',
    },
    [DeadlySin.EMOTIONAL_VACUUM]: {
      nameCn: '\u60c5\u611f\u771f\u7a7a',
      skill: 'fictional-dream',
      question:
        "\u662f\u5426\u5728'\u5c55\u793a'\u800c\u975e'\u53d9\u8ff0'\uff1f\u662f\u5426\u5f15\u5bfc\u8bfb\u8005\u7ecf\u5386\u60c5\u611f\u9636\u68af\uff1f",
    },
    [DeadlySin.NARRATIVE_STAGNATION]: {
      nameCn: '\u53d9\u4e8b\u505c\u6ede',
      skill: 'suspense-craft',
      question:
        '\u5f00\u7bc7\u662f\u5426\u6709\u6545\u4e8b\u95ee\u9898\uff1f\u89d2\u8272\u662f\u5426\u5904\u4e8e\u5a01\u80c1\u4e4b\u4e0b\uff1f\u662f\u5426\u6709\u7d27\u8feb\u611f\uff1f',
    },
    [DeadlySin.APATHETIC_COWARD]: {
      nameCn: '\u9ebb\u6728\u61e6\u592b',
      skill: 'character-forge',
      question:
        '\u4e3b\u89d2\u662f\u5426\u4e3b\u52a8\u89e3\u51b3\u51b2\u7a81\uff1f\u662f\u5426\u6709\u9a71\u52a8\u529b\u3001\u6b32\u671b\u548c\u8d85\u8d8a\u5e73\u5eb8\u7684\u7279\u8d28\uff1f',
    },
    [DeadlySin.AIMLESS_PLOTTING]: {
      nameCn: '\u65e0\u7684\u653e\u77e2',
      skill: 'premise-magic',
      question:
        '\u6545\u4e8b\u662f\u5426\u6709\u6e05\u6670\u7684\u9884\u8bbe\uff1f\u6bcf\u4e2a\u573a\u666f\u662f\u5426\u670d\u52a1\u4e8e\u6838\u5fc3\u9884\u8bbe\uff1f',
    },
    [DeadlySin.FACELESS_NARRATION]: {
      nameCn: '\u58f0\u97f3\u7f3a\u5931',
      skill: 'voice-workshop',
      question:
        "\u53d9\u8ff0\u8bed\u6c14\u662f\u5426\u7edf\u4e00\u6709\u529b\uff1f'\u8c01'\u5728\u8bb2\u6545\u4e8b\uff1f\u662f\u5426\u6709\u660e\u786e\u7684\u4f2a\u88c5\uff1f",
    },
    [DeadlySin.CHAOTIC_PRESENTATION]: {
      nameCn: '\u5448\u73b0\u6df7\u4e71',
      skill: 'presentation',
      question:
        '\u683c\u5f0f\u662f\u5426\u6e05\u6670\uff1f\u8fc7\u6e21\u662f\u5426\u6d41\u7545\uff1f\u89c6\u89c9\u5143\u7d20\u662f\u5426\u5f3a\u5316\u7ed3\u6784\uff1f',
    },
  };

  async evaluate(
    content: string,
    context?: Record<string, unknown>,
  ): Promise<EvaluationResult> {
    const ctx = context ?? {};
    const sinResults: SinCheckResult[] = [];

    sinResults.push(this.checkStructuralDrift(content, ctx));
    sinResults.push(this.checkEmotionalVacuum(content, ctx));
    sinResults.push(this.checkNarrativeStagnation(content, ctx));
    sinResults.push(this.checkApatheticCoward(content, ctx));
    sinResults.push(this.checkAimlessPlotting(content, ctx));
    sinResults.push(this.checkFacelessNarration(content, ctx));
    sinResults.push(this.checkChaoticPresentation(content, ctx));

    const issues: Issue[] = [];
    const metrics: Record<string, number> = {};

    for (const result of sinResults) {
      metrics[result.sin] = result.score;

      if (result.detected) {
        issues.push({
          code: `DEADLY_SIN_${result.sin.toUpperCase()}`,
          message: `\u3010${result.nameCn}\u3011${result.diagnosis}`,
          severity: result.severity,
          suggestion: result.prescription,
          relatedSkill: result.relatedSkill,
        });
      }
    }

    const totalScore =
      sinResults.reduce((sum, r) => sum + r.score, 0) / sinResults.length;

    const criticalSins = sinResults.filter(
      (r) => r.detected && r.severity === Severity.CRITICAL,
    );
    const majorSins = sinResults.filter(
      (r) => r.detected && r.severity === Severity.MAJOR,
    );

    const summary = this.generateSummary(
      totalScore,
      sinResults,
      criticalSins,
      majorSins,
    );

    return new EvaluationResult(
      this.name,
      totalScore,
      this.scoreToLevel(totalScore),
      issues,
      metrics,
      summary,
      {
        sin_results: sinResults.map((r) => ({
          sin: r.sin,
          name_cn: r.nameCn,
          detected: r.detected,
          severity: r.severity,
          score: r.score,
          diagnosis: r.diagnosis,
          prescription: r.prescription,
          related_skill: r.relatedSkill,
        })),
      },
    );
  }

  private checkStructuralDrift(
    content: string,
    context: Record<string, unknown>,
  ): SinCheckResult {
    const sin = DeadlySin.STRUCTURAL_DRIFT;
    const info = DeadlySinsChecker.SIN_INFO[sin];

    let score = 70;
    let detected = false;
    let diagnosis = '';

    const conclusionSignals = [
      '\u56e0\u6b64',
      '\u6240\u4ee5',
      '\u6211\u4eec\u8ba4\u4e3a',
      '\u7ed3\u8bba\u662f',
      '\u6838\u5fc3\u89c2\u70b9',
      '\u5efa\u8bae',
      '\u5e94\u8be5',
    ];
    const firstPara = content.length > 500 ? content.slice(0, 500) : content;

    const hasConclusion = conclusionSignals.some((s) => firstPara.includes(s));

    const structureMarkers = [
      '\u7b2c\u4e00',
      '\u7b2c\u4e8c',
      '\u9996\u5148',
      '\u5176\u6b21',
      '1.',
      '2.',
      '\u4e00\u3001',
      '\u4e8c\u3001',
    ];
    const hasStructure = structureMarkers.some((m) => content.includes(m));

    if (!hasConclusion) {
      score -= 30;
      detected = true;
      diagnosis =
        '\u5f00\u7bc7\u672a\u660e\u786e\u9648\u8ff0\u6838\u5fc3\u7ed3\u8bba\uff0c\u8bfb\u8005\u5728\u4fe1\u606f\u8ff7\u96fe\u4e2d\u6478\u7d22';
    }

    if (!hasStructure) {
      score -= 20;
      if (detected) {
        diagnosis += '\uff1b\u8bba\u8bc1\u7f3a\u4e4f\u5c42\u6b21\u7ed3\u6784';
      } else {
        detected = true;
        diagnosis = '\u8bba\u8bc1\u7f3a\u4e4f\u6e05\u6670\u7684\u5c42\u6b21\u7ed3\u6784';
      }
    }

    if (!detected) {
      diagnosis = '\u7ed3\u6784\u6e05\u6670\uff0c\u7ed3\u8bba\u660e\u786e';
    }

    return {
      sin,
      nameCn: info.nameCn,
      detected,
      severity:
        detected && score < 50
          ? Severity.MAJOR
          : detected
            ? Severity.MINOR
            : Severity.INFO,
      score: Math.max(0, score),
      diagnosis,
      prescription:
        '\u5c06\u6838\u5fc3\u7ed3\u8bba\u79fb\u81f3\u5f00\u7bc7\uff0c\u4f7f\u7528\u91d1\u5b57\u5854\u7ed3\u6784\u7ec4\u7ec7\u8bba\u8bc1',
      relatedSkill: info.skill,
    };
  }

  private checkEmotionalVacuum(
    content: string,
    context: Record<string, unknown>,
  ): SinCheckResult {
    const sin = DeadlySin.EMOTIONAL_VACUUM;
    const info = DeadlySinsChecker.SIN_INFO[sin];

    let score = 70;
    let detected = false;
    let diagnosis = '';

    const sensoryWords = [
      '\u770b\u5230',
      '\u542c\u5230',
      '\u95fb\u5230',
      '\u89e6\u6478',
      '\u611f\u89c9',
      '\u6e29\u5ea6',
      '\u989c\u8272',
      '\u58f0\u97f3',
      '\u5149\u7ebf',
      '\u6c14\u5473',
      '\u5473\u9053',
      '\u51b0\u51b7',
      '\u6e29\u6696',
      '\u523a\u75db',
      '\u98a4\u6296',
    ];
    const sensoryCount = sensoryWords.filter((w) => content.includes(w)).length;

    const abstractEmotions = [
      '\u9ad8\u5174',
      '\u96be\u8fc7',
      '\u5bb3\u6015',
      '\u6124\u6012',
      '\u7d27\u5f20',
      '\u6fc0\u52a8',
      '\u60b2\u4f24',
      '\u6050\u60e7',
    ];
    const abstractCount = abstractEmotions.filter((w) =>
      content.includes(w),
    ).length;

    if (sensoryCount < 3) {
      score -= 25;
      detected = true;
      diagnosis =
        "\u7f3a\u4e4f\u611f\u5b98\u7ec6\u8282\uff0c\u8bfb\u8005\u96be\u4ee5'\u611f\u53d7'\u573a\u666f";
    }

    if (abstractCount > sensoryCount && abstractCount > 3) {
      score -= 15;
      if (detected) {
        diagnosis += '\uff1b\u8fc7\u591a\u76f4\u63a5\u9648\u8ff0\u60c5\u611f\u800c\u975e\u5c55\u793a';
      } else {
        detected = true;
        diagnosis = '\u8fc7\u591a\u76f4\u63a5\u9648\u8ff0\u60c5\u611f\uff0c\u800c\u975e\u7528\u7ec6\u8282\u5c55\u793a';
      }
    }

    if (!detected) {
      diagnosis = '\u60c5\u611f\u8868\u8fbe\u4e30\u5bcc\uff0c\u611f\u5b98\u7ec6\u8282\u5145\u8db3';
    }

    return {
      sin,
      nameCn: info.nameCn,
      detected,
      severity:
        detected && score < 50
          ? Severity.MAJOR
          : detected
            ? Severity.MINOR
            : Severity.INFO,
      score: Math.max(0, score),
      diagnosis,
      prescription:
        "\u7528\u611f\u5b98\u7ec6\u8282\u66ff\u4ee3\u62bd\u8c61\u60c5\u611f\u8bcd\uff0c'\u5c55\u793a'\u800c\u975e'\u53d9\u8ff0'",
      relatedSkill: info.skill,
    };
  }

  private checkNarrativeStagnation(
    content: string,
    context: Record<string, unknown>,
  ): SinCheckResult {
    const sin = DeadlySin.NARRATIVE_STAGNATION;
    const info = DeadlySinsChecker.SIN_INFO[sin];

    let score = 70;
    let detected = false;
    let diagnosis = '';

    const questionSignals = [
      '\u4e3a\u4ec0\u4e48',
      '\u5982\u4f55',
      '\u662f\u5426',
      '\u7a76\u7adf',
      '\u5230\u5e95',
      '\uff1f',
    ];
    const questionCount = questionSignals.filter((s) =>
      content.includes(s),
    ).length;

    const threatSignals = [
      '\u5371\u9669',
      '\u5fc5\u987b',
      '\u6765\u4e0d\u53ca',
      '\u53ea\u6709',
      '\u6700\u540e',
      '\u5982\u679c\u4e0d',
      '\u5426\u5219',
    ];
    const threatCount = threatSignals.filter((s) => content.includes(s)).length;

    if (questionCount < 2) {
      score -= 20;
      detected = true;
      diagnosis = '\u7f3a\u4e4f\u5f15\u53d1\u597d\u5947\u7684\u6545\u4e8b\u95ee\u9898';
    }

    if (threatCount < 2) {
      score -= 15;
      if (detected) {
        diagnosis += '\uff1b\u89d2\u8272\u672a\u5904\u4e8e\u6709\u610f\u4e49\u7684\u5a01\u80c1\u4e4b\u4e0b';
      } else {
        detected = true;
        diagnosis = '\u89d2\u8272\u672a\u5904\u4e8e\u6709\u610f\u4e49\u7684\u5a01\u80c1\u4e4b\u4e0b';
      }
    }

    if (!detected) {
      diagnosis = '\u53d9\u4e8b\u6709\u5f20\u529b\uff0c\u60ac\u5ff5\u5143\u7d20\u5145\u8db3';
    }

    return {
      sin,
      nameCn: info.nameCn,
      detected,
      severity:
        detected && score < 50
          ? Severity.MAJOR
          : detected
            ? Severity.MINOR
            : Severity.INFO,
      score: Math.max(0, score),
      diagnosis,
      prescription:
        '\u63d0\u51fa\u6545\u4e8b\u95ee\u9898\u3001\u8bbe\u7f6e\u5a01\u80c1\u60c5\u5883\u3001\u70b9\u71c3\u65f6\u95f4\u5bfc\u706b\u7d22',
      relatedSkill: info.skill,
    };
  }

  private checkApatheticCoward(
    content: string,
    context: Record<string, unknown>,
  ): SinCheckResult {
    const sin = DeadlySin.APATHETIC_COWARD;
    const info = DeadlySinsChecker.SIN_INFO[sin];

    let score = 70;
    let detected = false;
    let diagnosis = '';

    const activeSignals = [
      '\u51b3\u5b9a',
      '\u9009\u62e9',
      '\u884c\u52a8',
      '\u51fa\u53d1',
      '\u9762\u5bf9',
      '\u53cd\u6297',
      '\u575a\u6301',
      '\u62d2\u7edd',
    ];
    const activeCount = activeSignals.filter((s) => content.includes(s)).length;

    const passiveSignals = [
      '\u5fcd\u53d7',
      '\u627f\u53d7',
      '\u65e0\u5948',
      '\u53ea\u80fd',
      '\u88ab\u8feb',
      '\u4e0d\u5f97\u4e0d',
    ];
    const passiveCount = passiveSignals.filter((s) => content.includes(s)).length;

    const conflictSignals = [
      '\u4e00\u65b9\u9762',
      '\u53e6\u4e00\u65b9\u9762',
      '\u65e2\u60f3',
      '\u53c8\u6015',
      '\u77db\u76fe',
      '\u6323\u624e',
      '\u72b9\u8c6b',
    ];
    const conflictCount = conflictSignals.filter((s) =>
      content.includes(s),
    ).length;

    if (activeCount < 2) {
      score -= 20;
      detected = true;
      diagnosis = '\u89d2\u8272\u7f3a\u4e4f\u4e3b\u52a8\u6027\uff0c\u672a\u79ef\u6781\u89e3\u51b3\u95ee\u9898';
    }

    if (passiveCount > activeCount) {
      score -= 15;
      if (detected) {
        diagnosis += '\uff1b\u89d2\u8272\u8fc7\u4e8e\u88ab\u52a8\u6d88\u6781';
      } else {
        detected = true;
        diagnosis = '\u89d2\u8272\u8fc7\u4e8e\u88ab\u52a8\uff0c\u53ea\u662f\u5fcd\u53d7\u800c\u975e\u884c\u52a8';
      }
    }

    if (conflictCount < 1 && content.length > 500) {
      score -= 10;
      if (detected) {
        diagnosis += '\uff1b\u7f3a\u4e4f\u5185\u5fc3\u51b2\u7a81\u7684\u5c55\u73b0';
      }
    }

    if (!detected) {
      diagnosis = '\u89d2\u8272\u4e3b\u52a8\u79ef\u6781\uff0c\u6709\u9a71\u52a8\u529b\u548c\u5185\u5fc3\u51b2\u7a81';
    }

    return {
      sin,
      nameCn: info.nameCn,
      detected,
      severity:
        detected && score < 50
          ? Severity.MAJOR
          : detected
            ? Severity.MINOR
            : Severity.INFO,
      score: Math.max(0, score),
      diagnosis,
      prescription:
        '\u8d4b\u4e88\u89d2\u8272\u4e3b\u52a8\u6027\u3001\u660e\u786e\u76ee\u6807\u548c\u5185\u5fc3\u51b2\u7a81',
      relatedSkill: info.skill,
    };
  }

  private checkAimlessPlotting(
    content: string,
    context: Record<string, unknown>,
  ): SinCheckResult {
    const sin = DeadlySin.AIMLESS_PLOTTING;
    const info = DeadlySinsChecker.SIN_INFO[sin];

    let score = 70;
    let detected = false;
    let diagnosis = '';

    const premise =
      typeof context['premise'] === 'string' ? context['premise'] : '';

    if (!premise) {
      score -= 20;
      detected = true;
      diagnosis =
        '\u672a\u63d0\u4f9b\u6545\u4e8b\u9884\u8bbe\uff0c\u65e0\u6cd5\u5224\u65ad\u60c5\u8282\u662f\u5426\u670d\u52a1\u4e8e\u6838\u5fc3\u4e3b\u9898';
    } else {
      const premiseWords = premise
        .replace(/\uff0c/g, ' ')
        .replace(/\u3002/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 1);
      const premiseInContent = premiseWords.filter((w) =>
        content.includes(w),
      ).length;

      if (premiseInContent < premiseWords.length * 0.3) {
        score -= 25;
        detected = true;
        diagnosis = `\u5185\u5bb9\u4e0e\u9884\u8bbe'${premise}'\u7684\u5173\u8054\u4e0d\u591f\u7d27\u5bc6`;
      }
    }

    const causalSignals = [
      '\u56e0\u4e3a',
      '\u6240\u4ee5',
      '\u5bfc\u81f4',
      '\u4e8e\u662f',
      '\u7ed3\u679c',
    ];
    const causalCount = causalSignals.filter((s) =>
      content.includes(s),
    ).length;

    if (causalCount < 2) {
      score -= 15;
      if (detected) {
        diagnosis += '\uff1b\u60c5\u8282\u4e4b\u95f4\u7f3a\u4e4f\u56e0\u679c\u5173\u8054';
      } else {
        detected = true;
        diagnosis = '\u60c5\u8282\u4e4b\u95f4\u7f3a\u4e4f\u660e\u786e\u7684\u56e0\u679c\u5173\u8054';
      }
    }

    if (!detected) {
      diagnosis = '\u60c5\u8282\u7d27\u6263\u9884\u8bbe\uff0c\u56e0\u679c\u94fe\u6761\u6e05\u6670';
    }

    return {
      sin,
      nameCn: info.nameCn,
      detected,
      severity:
        detected && score < 50
          ? Severity.MAJOR
          : detected
            ? Severity.MINOR
            : Severity.INFO,
      score: Math.max(0, score),
      diagnosis,
      prescription:
        '\u660e\u786e\u9884\u8bbe\uff0c\u786e\u4fdd\u6bcf\u4e2a\u573a\u666f\u90fd\u670d\u52a1\u4e8e\u6838\u5fc3\u9884\u8bbe',
      relatedSkill: info.skill,
    };
  }

  private checkFacelessNarration(
    content: string,
    context: Record<string, unknown>,
  ): SinCheckResult {
    const sin = DeadlySin.FACELESS_NARRATION;
    const info = DeadlySinsChecker.SIN_INFO[sin];

    let score = 75;
    let detected = false;
    let diagnosis = '';

    const formalMarkers = [
      '\u7136\u800c',
      '\u56e0\u6b64',
      '\u7efc\u4e0a\u6240\u8ff0',
      '\u9274\u4e8e',
    ];
    const informalMarkers = [
      '\u5176\u5b9e\u5427',
      '\u4f60\u61c2\u7684',
      '\u8bf4\u767d\u4e86',
      '\u53cd\u6b63',
    ];

    const formalCount = formalMarkers.filter((m) => content.includes(m)).length;
    const informalCount = informalMarkers.filter((m) =>
      content.includes(m),
    ).length;

    if (formalCount > 0 && informalCount > 0) {
      score -= 20;
      detected = true;
      diagnosis = '\u53d9\u8ff0\u8bed\u6c14\u4e0d\u4e00\u81f4\uff0c\u6b63\u5f0f\u4e0e\u53e3\u8bed\u98ce\u683c\u6df7\u6742';
    }

    const firstPerson =
      content.split('\u6211').length -
      1 +
      (content.split('\u6211\u4eec').length - 1);
    const secondPerson =
      content.split('\u4f60').length -
      1 +
      (content.split('\u4f60\u4eec').length - 1);

    if (firstPerson > 5 && secondPerson > 5) {
      score -= 15;
      if (detected) {
        diagnosis += '\uff1b\u53d9\u8ff0\u89c6\u89d2\u4e0d\u7edf\u4e00';
      } else {
        detected = true;
        diagnosis =
          '\u53d9\u8ff0\u89c6\u89d2\u6df7\u4e71\uff0c\u7b2c\u4e00\u4eba\u79f0\u4e0e\u7b2c\u4e8c\u4eba\u79f0\u9891\u7e41\u5207\u6362';
      }
    }

    if (!detected) {
      diagnosis = '\u53d9\u4e8b\u58f0\u97f3\u7edf\u4e00\uff0c\u8bed\u6c14\u4e00\u81f4';
    }

    return {
      sin,
      nameCn: info.nameCn,
      detected,
      severity: detected ? Severity.MINOR : Severity.INFO,
      score: Math.max(0, score),
      diagnosis,
      prescription:
        '\u786e\u5b9a\u53d9\u8ff0\u8005\u8eab\u4efd\uff0c\u4fdd\u6301\u8bed\u6c14\u548c\u89c6\u89d2\u7684\u4e00\u81f4\u6027',
      relatedSkill: info.skill,
    };
  }

  private checkChaoticPresentation(
    content: string,
    context: Record<string, unknown>,
  ): SinCheckResult {
    const sin = DeadlySin.CHAOTIC_PRESENTATION;
    const info = DeadlySinsChecker.SIN_INFO[sin];

    let score = 75;
    let detected = false;
    let diagnosis = '';

    const paragraphs = content
      .split('\n\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (paragraphs.length > 0) {
      const longParas = paragraphs.filter((p) => p.length > 500).length;
      if (longParas > paragraphs.length * 0.3) {
        score -= 15;
        detected = true;
        diagnosis = '\u5b58\u5728\u8fc7\u957f\u6bb5\u843d\uff0c\u5f71\u54cd\u9605\u8bfb\u4f53\u9a8c';
      }
    }

    const transitionWords = [
      '\u63a5\u4e0b\u6765',
      '\u6b64\u5916',
      '\u7136\u800c',
      '\u56e0\u6b64',
      '\u7efc\u4e0a',
      '\u9996\u5148',
      '\u5176\u6b21',
    ];
    const transitionCount = transitionWords.filter((w) =>
      content.includes(w),
    ).length;

    if (paragraphs.length > 3 && transitionCount < 2) {
      score -= 15;
      if (detected) {
        diagnosis += '\uff1b\u6bb5\u843d\u4e4b\u95f4\u7f3a\u4e4f\u8fc7\u6e21';
      } else {
        detected = true;
        diagnosis = '\u6bb5\u843d\u4e4b\u95f4\u7f3a\u4e4f\u8fc7\u6e21\u8bcd\uff0c\u8df3\u8dc3\u611f\u5f3a';
      }
    }

    const hasHeaders = content.includes('#') || content.includes('##');
    const hasLists =
      content.includes('- ') || content.includes('1.') || content.includes('\u2022');

    if (content.length > 1000 && !hasHeaders && !hasLists) {
      score -= 10;
      if (detected) {
        diagnosis += '\uff1b\u7f3a\u4e4f\u683c\u5f0f\u5316\u5143\u7d20';
      } else {
        detected = true;
        diagnosis =
          '\u957f\u6587\u7f3a\u4e4f\u683c\u5f0f\u5316\u5143\u7d20\uff08\u6807\u9898\u3001\u5217\u8868\u7b49\uff09';
      }
    }

    if (!detected) {
      diagnosis = '\u5448\u73b0\u6e05\u6670\uff0c\u683c\u5f0f\u89c4\u8303\uff0c\u8fc7\u6e21\u6d41\u7545';
    }

    return {
      sin,
      nameCn: info.nameCn,
      detected,
      severity: detected ? Severity.MINOR : Severity.INFO,
      score: Math.max(0, score),
      diagnosis,
      prescription:
        '\u4f18\u5316\u6bb5\u843d\u957f\u5ea6\uff0c\u6dfb\u52a0\u8fc7\u6e21\u53e5\uff0c\u4f7f\u7528\u683c\u5f0f\u5316\u5143\u7d20\u7a81\u51fa\u7ed3\u6784',
      relatedSkill: info.skill,
    };
  }

  private generateSummary(
    score: number,
    sinResults: SinCheckResult[],
    criticalSins: SinCheckResult[],
    majorSins: SinCheckResult[],
  ): string {
    const detectedCount = sinResults.filter((r) => r.detected).length;

    let summary = `\u4e03\u4e2a\u81f4\u547d\u9519\u8bef\u68c0\u67e5\uff1a${score.toFixed(1)}/100\uff0c\u53d1\u73b0${detectedCount}\u4e2a\u95ee\u9898\u3002`;

    if (criticalSins.length > 0) {
      const names = criticalSins.map((s) => s.nameCn).join(', ');
      summary += `\u4e25\u91cd\u95ee\u9898\uff1a${names}\u3002`;
    } else if (majorSins.length > 0) {
      const names = majorSins.map((s) => s.nameCn).join(', ');
      summary += `\u4e3b\u8981\u95ee\u9898\uff1a${names}\u3002`;
    } else {
      summary += '\u6574\u4f53\u8d28\u91cf\u826f\u597d\u3002';
    }

    return summary;
  }

  override quickScan(content: string): EvaluationResult {
    const issues: Issue[] = [];
    let score = 70;

    if (
      !content.includes('\u7b2c\u4e00') &&
      !content.includes('\u9996\u5148')
    ) {
      issues.push({
        code: 'DEADLY_SIN_STRUCTURAL_DRIFT',
        message: '\u53ef\u80fd\u5b58\u5728\u7ed3\u6784\u6f02\u79fb',
        severity: Severity.MINOR,
        relatedSkill: 'pyramid-structure',
      });
      score -= 10;
    }

    const sensoryWords = ['\u770b\u5230', '\u542c\u5230', '\u611f\u89c9', '\u89e6\u6478'];
    if (!sensoryWords.some((w) => content.includes(w))) {
      issues.push({
        code: 'DEADLY_SIN_EMOTIONAL_VACUUM',
        message: '\u53ef\u80fd\u5b58\u5728\u60c5\u611f\u771f\u7a7a',
        severity: Severity.MINOR,
        relatedSkill: 'fictional-dream',
      });
      score -= 10;
    }

    return new EvaluationResult(
      this.name,
      score,
      this.scoreToLevel(score),
      issues,
      {},
      `\u5feb\u901f\u626b\u63cf\uff1a${score}/100`,
    );
  }
}
