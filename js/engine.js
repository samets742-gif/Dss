/**
 * Движок ситуационного управления (по методу Поспелова Д.А.)
 *
 * Принцип работы:
 * 1. Текущая ситуация S = { дескриптор: значение, ... }
 * 2. База знаний KB = список правил { ситуация, решение, действия }
 * 3. Сопоставление: для каждого правила вычисляется степень подобия
 *    σ(S, Si) ∈ [0, 1] на основе взвешенного совпадения дескрипторов
 * 4. Возвращаются топ-N наиболее подходящих правил
 */

class SituationalEngine {
  /**
   * @param {Object} knowledgeBase - база знаний { meta, attributes, rules }
   */
  constructor(knowledgeBase) {
    this.kb = knowledgeBase;
    // Индексируем порядковые шкалы для вычисления частичного подобия
    this._ordinalIndex = {};
    for (const [attrId, attr] of Object.entries(knowledgeBase.attributes)) {
      if (attr.type === 'ordinal') {
        this._ordinalIndex[attrId] = attr.values.map(v => v.id);
      }
    }
  }

  /**
   * Степень подобия двух значений одного дескриптора.
   * - Для номинальных: 1 если совпали, 0 иначе
   * - Для порядковых: линейный спад по расстоянию на шкале
   */
  _valueSimilarity(attrId, current, rule) {
    if (current === rule) return 1;
    const scale = this._ordinalIndex[attrId];
    if (!scale) return 0;
    const ci = scale.indexOf(current);
    const ri = scale.indexOf(rule);
    if (ci === -1 || ri === -1) return 0;
    return 1 - Math.abs(ci - ri) / (scale.length - 1);
  }

  /**
   * Вычисляет взвешенную степень подобия текущей ситуации и правила.
   * Неуказанные пользователем дескрипторы пропускаются (partial matching).
   *
   * @param {Object} current   - текущая ситуация { attrId: valueId }
   * @param {Object} rule      - правило из базы знаний
   * @returns {number} σ ∈ [0, 1]
   */
  similarity(current, rule) {
    const weights = rule.weights || {};
    let totalW = 0;
    let matchW = 0;

    for (const [attrId, ruleVal] of Object.entries(rule.situation)) {
      const w = weights[attrId] ?? 1;
      totalW += w;
      if (current[attrId] !== undefined) {
        matchW += w * this._valueSimilarity(attrId, current[attrId], ruleVal);
      }
      // Если атрибут не задан — вклад 0 (ситуация не противоречит правилу,
      // но и не подтверждает его по этому дескриптору)
    }

    return totalW > 0 ? matchW / totalW : 0;
  }

  /**
   * Анализирует текущую ситуацию и возвращает наиболее подходящие решения.
   *
   * @param {Object} current     - текущая ситуация
   * @param {number} topN        - количество лучших решений
   * @param {number} threshold   - минимальный порог подобия
   * @returns {Array} отсортированный список { rule, score, confidence }
   */
  analyze(current, topN = 3, threshold = 0.25) {
    const results = this.kb.rules
      .map(rule => ({
        rule,
        score: this.similarity(current, rule)
      }))
      .filter(r => r.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
      .map(r => ({
        ...r,
        confidence: this._scoreToConfidence(r.score)
      }));

    return results;
  }

  /**
   * Переводит числовой score в текстовый уровень уверенности.
   */
  _scoreToConfidence(score) {
    if (score >= 0.85) return { level: 'high',   label: 'Высокая',   color: '#22c55e' };
    if (score >= 0.65) return { level: 'medium', label: 'Средняя',   color: '#f59e0b' };
    if (score >= 0.40) return { level: 'low',    label: 'Низкая',    color: '#f97316' };
    return               { level: 'very-low', label: 'Очень низкая', color: '#ef4444' };
  }

  /**
   * Возвращает перечень дескрипторов с их метаданными.
   */
  getAttributes() {
    return Object.entries(this.kb.attributes).map(([id, attr]) => ({ id, ...attr }));
  }
}
