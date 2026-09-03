(() => {
  "use strict";

  const PHOTO_DEFS = [
    { id: "panel-overview", title: "分電盤", point: "外から全体が分かる位置", important: true, panelWarn: true, phase: "survey", group: "survey" },
    { id: "main-breaker", title: "主幹ブレーカー", point: "表示が読める外観", important: true, panelWarn: true, phase: "survey", group: "survey-more" },
    { id: "branch-labels", title: "分岐・回路表示", point: "ラベルが分かる範囲", important: true, panelWarn: true, phase: "survey", group: "survey-more" },
    { id: "ac-nameplate", title: "エアコン銘板", point: "電圧などが読める面", important: true, phase: "survey", group: "survey-more" },
    { id: "indoor-place", title: "室内機", point: "設置場所の様子", important: false, phase: "survey", group: "survey" },
    { id: "outdoor-place", title: "室外機", point: "設置場所の様子", important: false, phase: "survey", group: "survey" },
    { id: "existing-outlet", title: "設置場所", point: "コンセントや取付壁面", important: false, phase: "survey", group: "survey" },
    { id: "route-plan", title: "その他", point: "配線・配管のルートなど", important: false, phase: "survey", group: "survey" },
  ];
  const EXEC_PHOTO_DEFS = [
    { id: "exec-before", title: "施工前", point: "作業範囲", important: false, phase: "execution" },
    { id: "exec-wiring", title: "配線・配管", point: "途中の状態", important: false, phase: "execution" },
    { id: "exec-terminal", title: "接続部", point: "端末処理", important: false, phase: "execution" },
    { id: "exec-before-conceal", title: "隠蔽前", point: "隠す前の状態", important: false, phase: "execution" },
  ];
  const COMP_PHOTO_DEFS = [
    { id: "comp-panel", title: "分電盤", point: "回路表示", important: false, panelWarn: true, phase: "completion" },
    { id: "comp-outlet", title: "コンセント", point: "接続部の仕上がり", important: false, phase: "completion" },
    { id: "comp-indoor", title: "室内機", point: "設置完了", important: false, phase: "completion" },
    { id: "comp-outdoor", title: "室外機", point: "設置完了", important: false, phase: "completion" },
    { id: "comp-finish", title: "仕上げ", point: "貫通部・配管", important: false, phase: "completion" },
  ];
  const ALL_PHOTO_DEFS = [...PHOTO_DEFS, ...EXEC_PHOTO_DEFS, ...COMP_PHOTO_DEFS];
  const SURVEY_PHOTO_IDS = new Set(PHOTO_DEFS.map((d) => d.id));

  const PREP_CHECK_ITEMS = [
    { key: "equipmentSpec", label: "機器の型式・仕様" },
    { key: "manualCheck", label: "施工説明書" },
    { key: "materialsReady", label: "材料の準備" },
    { key: "toolsReady", label: "工具・測定器" },
    { key: "licenseScope", label: "資格の範囲" },
    { key: "powerIsolation", label: "停電・対象回路" },
    { key: "siteProtection", label: "養生" },
    { key: "workLocation", label: "作業場所・高所" },
    { key: "drillingCheck", label: "穴あけ・隠蔽物" },
    { key: "asbestosCheck", label: "石綿の事前確認" },
    { key: "customerApproval", label: "お客様の了解" },
  ];
  const OPERATION_CHECK_ITEMS = [
    { key: "powerOn", label: "電源投入後の動作" },
    { key: "errorDisplay", label: "エラー表示" },
    { key: "noiseVibration", label: "異音・振動" },
    { key: "indoorCheck", label: "室内機" },
    { key: "outdoorCheck", label: "室外機" },
    { key: "drain", label: "ドレン排水" },
    { key: "pipeInsulation", label: "配管・断熱" },
    { key: "circuitLabel", label: "回路表示" },
    { key: "cleanup", label: "清掃" },
    { key: "customerBrief", label: "お客様への説明" },
  ];
  const CHECK_STATES = ["未確認", "確認済み", "要対応", "該当なし"];
  const STOP_REASONS = [
    "対象回路を特定できない",
    "安全に遮断できない",
    "既設設備に焦げ・発熱・水濡れ・破損の疑い",
    "機器型式と電源条件が一致しない",
    "穴あけ位置・隠蔽物が確認できない",
    "石綿事前調査が未確認",
    "高所・天候・作業場所の安全条件を満たさない",
    "必要資格・作業担当を確認できない",
    "必要工具・測定器・材料が不足",
    "調査結果と現場条件が違う",
    "顧客・管理者の承認待ち",
    "その他",
  ];
  const PHASES = ["survey", "preparation", "execution", "completion"];
  const PHASE_LABELS = { survey: "現地調査", preparation: "施工準備", execution: "施工中", completion: "完了確認" };
  const WORK_TYPES = [
    { value: "エアコン新設", label: "エアコン新設", hint: "取付から" },
    { value: "エアコン交換", label: "エアコン交換", hint: "取付と取外し" },
    { value: "専用コンセント新設", label: "専用回路工事", hint: "電源から" },
    { value: "電圧切替を含む可能性", label: "電圧切替を含む工事", hint: "100V / 200V" },
  ];
  const WIRING_OPTIONS = [
    { value: "不要", label: "不要" },
    { value: "隠蔽できそう", label: "隠蔽" },
    { value: "露出配線になりそう", label: "露出" },
    { value: "現地確認が必要", label: "要確認" },
    { value: "不明", label: "不明" },
  ];
  const PLACE_OPTIONS = ["通常", "屋根", "壁面", "天吊り", "二段置き", "別階", "その他", "未確認"];
  const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
  const BLOCKED_IMAGE_TYPES = new Set(["image/svg+xml", "text/html"]);
  const AI_JPEG_MAX_BYTES = 4 * 1024 * 1024;
  const AI_COOLDOWN_MS = 20000;
  const AI_CLIENT_TIMEOUT_MS = 55000;
  const AI_CONSENT_MESSAGE =
    "このJPEG写真1枚をOpenAIへ送信して、現地確認用の読取結果を作成します。\n" +
    "写真内容は外部AIサービスへ送信されます。\n" +
    "施工可否・電線サイズ・遮断器・接続方法は断定しません。\n" +
    "送信しますか？";

  const photoState = {};
  const pendingPhotoOps = new Map();
  const aiMockRuntime = {};
  let dirtyHandler = null;
  let clearHandler = null;
  let suppressDirty = false;
  const phaseStatus = { survey: "未着手", preparation: "未着手", execution: "未着手", completion: "未着手" };
  let currentPhase = "survey";
  let currentView = "field";
  let surveyDiagnosed = false;
  let lastSurveyResult = null;
  let stopRecord = createEmptyStopRecord();
  let prepChecks = emptyChecks(PREP_CHECK_ITEMS);
  let operationChecks = emptyChecks(OPERATION_CHECK_ITEMS);
  let prepStartState = "未判定";
  let execState = "未着手";
  let handoverState = "未判定";
  let planChange = emptyPlanChange();
  let materials = [emptyMaterial()];
  let extraWorks = [emptyExtraWork()];
  let measures = [emptyMeasure()];
  let prepText = { workSummary: "", method: "", route: "", worker: "", supervisor: "", memo: "" };
  let execMemo = "";
  let compMemo = "";
  let site = emptySite();
  let aiSuggestions = [];
  let quoteState = window.BCEstimate.loadState();
  let estCategory = "エアコン工事";
  let showMorePhotos = false;
  let fieldNotices = [];
  let fieldMaterials = [];
  let pickerSlot = null;

  ALL_PHOTO_DEFS.forEach((def) => {
    photoState[def.id] = emptyPhoto();
  });

  function el(id) { return document.getElementById(id); }
  function nowIso() { return new Date().toISOString(); }
  function emptyPhoto() {
    return { objectUrl: null, blob: null, fileName: "", mimeType: "", size: null, lastModified: null, registered: false, previewFailed: false, missingBlob: false };
  }
  function emptyChecks(items) {
    return items.map((item) => ({ key: item.key, label: item.label, state: "未確認", naReason: "" }));
  }
  function emptyPlanChange() {
    return { state: "未確認", before: "", after: "", reason: "", safetyImpact: "", costImpact: "", customerConfirm: "", supervisorConfirm: "", qualifiedConfirm: "" };
  }
  function emptyMaterial() { return { id: "", name: "", spec: "", qty: "", unit: "", note: "" }; }
  function emptyExtraWork() { return { id: "", content: "", reason: "", customer: "", note: "" }; }
  function emptyMeasure() {
    return { id: "", name: "", target: "", value: "", unit: "", meterId: "", basis: "", judgment: "", measurer: "", measuredAt: "", note: "" };
  }
  function createEmptyStopRecord() {
    return { active: false, reason: "", otherDetail: "", facts: "", safety: "", resumeCondition: "", recorder: "", recordedAt: "", resumed: false, resolveDetail: "", resumeConfirmer: "", resumeConfirmedAt: "" };
  }
  function emptySite() {
    return {
      workType: "",
      installCount: 0,
      removeCount: 0,
      acVoltage: "",
      dedicatedCircuit: "",
      wiringRoute: "",
      wireDistance: null,
      wireDistanceUnknown: false,
      billableWireM: 0,
      outdoorPlace: "",
      hole: "",
      holeCount: 0,
      cover: "",
      coverLengthM: null,
      pipeExtM: 0,
      voltChange: "",
      powerSystem: "",
      mainBreaker: "",
      spareCircuit: "",
    };
  }

  function notifyDirty() {
    if (suppressDirty) return;
    if (typeof dirtyHandler === "function") dirtyHandler();
    renderCta();
  }
  function notePersistableChangeForPhoto() {
    notifyDirty();
    const pers = window.BCFDCasePersistence;
    return pers && typeof pers.getEditGeneration === "function" ? pers.getEditGeneration() : 1;
  }
  function isPhotoPresent(state) {
    return Boolean(state && (state.blob || state.objectUrl || state.registered || state.missingBlob));
  }
  function isJpegPhoto(state) {
    const mime = String((state && state.mimeType) || (state && state.blob && state.blob.type) || "").toLowerCase();
    return mime === "image/jpeg" || mime === "image/jpg";
  }
  function isAiLoggedIn() {
    const auth = window.BCFDAiAuth;
    const session = auth && typeof auth.getSession === "function" ? auth.getSession() : null;
    return Boolean(session && session.email);
  }
  function getAiMockRuntime(id) {
    if (!aiMockRuntime[id]) aiMockRuntime[id] = { busy: false, error: "", cooldownUntil: 0, candidate: null };
    return aiMockRuntime[id];
  }
  function clearAiMock(id) {
    aiMockRuntime[id] = { busy: false, error: "", cooldownUntil: 0, candidate: null };
    aiSuggestions = aiSuggestions.filter((s) => s.slotId !== id);
  }
  function clearAllAiMocks() {
    Object.keys(aiMockRuntime).forEach((id) => clearAiMock(id));
    aiSuggestions = [];
  }
  function revokePhoto(id) {
    const state = photoState[id];
    if (state && state.objectUrl) {
      try { URL.revokeObjectURL(state.objectUrl); } catch (_) { /* ignore */ }
    }
    photoState[id] = emptyPhoto();
  }
  function revokeAllPhotos() {
    ALL_PHOTO_DEFS.forEach((def) => revokePhoto(def.id));
  }
  function markPhotoPut(id) {
    const def = ALL_PHOTO_DEFS.find((d) => d.id === id);
    const state = photoState[id];
    const generation = notePersistableChangeForPhoto();
    pendingPhotoOps.set(id, {
      type: "put",
      generation,
      blob: state.blob,
      metadata: {
        phase: (def && def.phase) || "survey",
        fileName: state.fileName,
        mimeType: state.mimeType,
        size: state.size,
        lastModified: state.lastModified,
      },
    });
  }
  function markPhotoDelete(id) {
    const generation = notePersistableChangeForPhoto();
    pendingPhotoOps.set(id, { type: "delete", generation });
  }

  function outdoorFromSite(s) {
    const out = [];
    if (s.outdoorPlace === "通常") out.push("標準的");
    if (s.outdoorPlace === "屋根" || s.outdoorPlace === "壁面" || s.outdoorPlace === "天吊り" || s.outdoorPlace === "二段置き") {
      out.push("高所作業候補");
    }
    if (s.hole === "あり") out.push("穴あけ候補");
    if (s.cover === "あり") out.push("化粧カバー候補");
    if (s.outdoorPlace === "未確認" && s.hole === "不明" && s.cover === "不明") out.push("不明");
    if (!out.length && (s.outdoorPlace === "未確認" || s.hole === "不明" || s.cover === "不明")) out.push("不明");
    return out;
  }

  function siteFromManual(manual, info, extra) {
    const next = emptySite();
    next.workType = (info && info.workType) || "";
    next.acVoltage = manual.acVoltage || "";
    next.dedicatedCircuit = manual.dedicatedCircuit || "";
    next.wiringRoute = manual.wiringRoute || "";
    next.wireDistance = manual.wireDistance == null ? null : Number(manual.wireDistance);
    next.wireDistanceUnknown = Boolean(manual.wireDistanceUnknown);
    next.powerSystem = manual.powerSystem || "";
    next.mainBreaker = manual.mainBreaker || "";
    next.spareCircuit = manual.spareCircuit || "";
    const outdoor = Array.isArray(manual.outdoor) ? manual.outdoor : [];
    if (outdoor.includes("穴あけ候補")) { next.hole = "あり"; next.holeCount = 1; }
    if (outdoor.includes("化粧カバー候補")) next.cover = "あり";
    if (outdoor.includes("標準的")) next.outdoorPlace = "通常";
    else if (outdoor.includes("高所作業候補")) next.outdoorPlace = "";
    if (extra && typeof extra === "object") Object.assign(next, extra);
    if (next.workType === "エアコン新設" && !next.installCount) next.installCount = 1;
    if (next.workType === "エアコン交換") {
      if (!next.installCount) next.installCount = 1;
      if (!next.removeCount) next.removeCount = 1;
    }
    return next;
  }

  function applyWorkTypeDefaults(value) {
    site.workType = value;
    if (value === "エアコン新設") {
      if (!site.installCount) site.installCount = 1;
    } else if (value === "エアコン交換") {
      if (!site.installCount) site.installCount = 1;
      if (!site.removeCount) site.removeCount = 1;
    } else if (value === "電圧切替を含む可能性") {
      if (!site.voltChange) site.voltChange = "必要";
    }
  }

  function isAcWork() {
    return site.workType === "エアコン新設" || site.workType === "エアコン交換";
  }
  function needsDedicatedFollowup() {
    return site.dedicatedCircuit === "なし" || site.workType === "専用コンセント新設";
  }

  function createEmptySnapshot() {
    return {
      schemaVersion: "1B-2A",
      snapshotAt: nowIso(),
      caseInfo: { caseName: "", siteMemo: "", workType: "" },
      workflow: {
        currentPhase: "survey",
        phaseStatus: { survey: "未着手", preparation: "未着手", execution: "未着手", completion: "未着手" },
      },
      survey: {
        diagnosed: false,
        manual: {
          powerSystem: "",
          mainBreaker: "",
          spareCircuit: "",
          acVoltage: "",
          dedicatedCircuit: "",
          wiringRoute: "",
          wireDistance: null,
          wireDistanceUnknown: false,
          outdoor: [],
        },
        siteConfirm: emptySite(),
        diagnosis: null,
        unresolved: [],
      },
      preparation: {
        workSummary: "", method: "", route: "", worker: "", supervisor: "",
        startState: "未判定", memo: "",
        checks: emptyChecks(PREP_CHECK_ITEMS),
        stopRecord: createEmptyStopRecord(),
      },
      execution: {
        state: "未着手", memo: "",
        materials: [emptyMaterial()],
        planChange: emptyPlanChange(),
        extraWorks: [emptyExtraWork()],
      },
      completion: {
        measures: [emptyMeasure()],
        operationChecks: emptyChecks(OPERATION_CHECK_ITEMS),
        handoverState: "未判定",
        memo: "",
      },
      alerts: [],
      photoMetadata: ALL_PHOTO_DEFS.map((def) => ({
        slotKey: def.id, phase: def.phase || "survey", fileName: "", mimeType: "", size: null, lastModified: null, registered: false,
      })),
    };
  }

  function createCaseSnapshot() {
    const caseName = (el("case-name") && el("case-name").value) || "";
    const siteMemo = (el("site-memo") && el("site-memo").value) || "";
    return {
      schemaVersion: "1B-2A",
      snapshotAt: nowIso(),
      caseInfo: { caseName, siteMemo, workType: site.workType || "" },
      workflow: { currentPhase, phaseStatus: { ...phaseStatus } },
      survey: {
        diagnosed: surveyDiagnosed,
        manual: {
          powerSystem: site.powerSystem,
          mainBreaker: site.mainBreaker,
          spareCircuit: site.spareCircuit,
          acVoltage: site.acVoltage,
          dedicatedCircuit: site.dedicatedCircuit,
          wiringRoute: site.wiringRoute,
          wireDistance: site.wireDistance,
          wireDistanceUnknown: site.wireDistanceUnknown,
          outdoor: outdoorFromSite(site),
        },
        siteConfirm: { ...site },
        diagnosis: lastSurveyResult
          ? {
              verdicts: lastSurveyResult.verdicts,
              reasons: lastSurveyResult.reasons,
              unknowns: lastSurveyResult.unknowns,
              neededPhotos: lastSurveyResult.neededPhotos,
              estimates: lastSurveyResult.estimates,
              extraWorks: lastSurveyResult.extraWorks,
            }
          : null,
        unresolved: [],
      },
      preparation: {
        workSummary: prepText.workSummary,
        method: prepText.method,
        route: prepText.route,
        worker: prepText.worker,
        supervisor: prepText.supervisor,
        startState: prepStartState,
        memo: prepText.memo,
        checks: prepChecks.map((x) => ({ ...x })),
        stopRecord: { ...stopRecord },
      },
      execution: {
        state: execState,
        memo: execMemo,
        materials: materials.map((x) => ({ ...x })),
        planChange: { ...planChange },
        extraWorks: extraWorks.map((x) => ({ ...x })),
      },
      completion: {
        measures: measures.map((x) => ({ ...x })),
        operationChecks: operationChecks.map((x) => ({ ...x })),
        handoverState,
        memo: compMemo,
      },
      alerts: [],
      photoMetadata: ALL_PHOTO_DEFS.map((def) => {
        const state = photoState[def.id];
        return {
          slotKey: def.id,
          phase: def.phase || "survey",
          fileName: state.fileName || "",
          mimeType: state.mimeType || "",
          size: state.size,
          lastModified: state.lastModified,
          registered: Boolean(state.registered || state.objectUrl || state.blob || state.missingBlob),
        };
      }),
    };
  }

  function clearCurrentCaseForm({ revoke = true } = {}) {
    if (el("case-name")) el("case-name").value = "";
    if (el("site-memo")) el("site-memo").value = "";
    site = emptySite();
    prepText = { workSummary: "", method: "", route: "", worker: "", supervisor: "", memo: "" };
    execMemo = "";
    compMemo = "";
    prepStartState = "未判定";
    execState = "未着手";
    handoverState = "未判定";
    planChange = emptyPlanChange();
    materials = [emptyMaterial()];
    extraWorks = [emptyExtraWork()];
    measures = [emptyMeasure()];
    prepChecks = emptyChecks(PREP_CHECK_ITEMS);
    operationChecks = emptyChecks(OPERATION_CHECK_ITEMS);
    stopRecord = createEmptyStopRecord();
    surveyDiagnosed = false;
    lastSurveyResult = null;
    fieldNotices = [];
    fieldMaterials = [];
    aiSuggestions = [];
    PHASES.forEach((p) => { phaseStatus[p] = "未着手"; });
    if (revoke) revokeAllPhotos();
    else clearAllAiMocks();
    switchPhase("survey", { silent: true });
    renderAll();
  }

  async function applyCaseSnapshot(snapshot, photoBundle) {
    const snap = snapshot && typeof snapshot === "object" ? snapshot : createEmptySnapshot();
    const photos = photoBundle && typeof photoBundle === "object" ? photoBundle : {};
    suppressDirty = true;
    try {
      revokeAllPhotos();
      clearCurrentCaseForm({ revoke: false });
      const info = snap.caseInfo || {};
      if (el("case-name")) el("case-name").value = info.caseName || "";
      if (el("site-memo")) el("site-memo").value = info.siteMemo || "";
      const manual = (snap.survey && snap.survey.manual) || {};
      const extra = (snap.survey && snap.survey.siteConfirm) || {};
      site = siteFromManual(manual, info, extra);
      if (snap.survey && snap.survey.diagnosed) surveyDiagnosed = true;
      lastSurveyResult = (snap.survey && snap.survey.diagnosis) || null;

      const prep = snap.preparation || {};
      prepText = {
        workSummary: prep.workSummary || "",
        method: prep.method || "",
        route: prep.route || "",
        worker: prep.worker || "",
        supervisor: prep.supervisor || "",
        memo: prep.memo || "",
      };
      prepStartState = prep.startState || "未判定";
      if (Array.isArray(prep.checks) && prep.checks.length) {
        const byKey = {};
        prep.checks.forEach((row) => { if (row && row.key) byKey[row.key] = row; });
        prepChecks = PREP_CHECK_ITEMS.map((item) => ({
          key: item.key,
          label: item.label,
          state: (byKey[item.key] && byKey[item.key].state) || "未確認",
          naReason: (byKey[item.key] && byKey[item.key].naReason) || "",
        }));
      }
      if (prep.stopRecord) stopRecord = { ...createEmptyStopRecord(), ...prep.stopRecord };

      const exe = snap.execution || {};
      execState = exe.state || "未着手";
      execMemo = exe.memo || "";
      if (Array.isArray(exe.materials) && exe.materials.length) materials = exe.materials.map((x) => ({ ...emptyMaterial(), ...x }));
      if (exe.planChange) planChange = { ...emptyPlanChange(), ...exe.planChange };
      if (Array.isArray(exe.extraWorks) && exe.extraWorks.length) extraWorks = exe.extraWorks.map((x) => ({ ...emptyExtraWork(), ...x }));

      const comp = snap.completion || {};
      if (Array.isArray(comp.measures) && comp.measures.length) measures = comp.measures.map((x) => ({ ...emptyMeasure(), ...x }));
      if (Array.isArray(comp.operationChecks) && comp.operationChecks.length) {
        const byKey = {};
        comp.operationChecks.forEach((row) => { if (row && row.key) byKey[row.key] = row; });
        operationChecks = OPERATION_CHECK_ITEMS.map((item) => ({
          key: item.key,
          label: item.label,
          state: (byKey[item.key] && byKey[item.key].state) || "未確認",
          naReason: (byKey[item.key] && byKey[item.key].naReason) || "",
        }));
      }
      handoverState = comp.handoverState || "未判定";
      compMemo = comp.memo || "";

      const metaBySlot = {};
      (snap.photoMetadata || []).forEach((m) => { if (m && m.slotKey) metaBySlot[m.slotKey] = m; });
      ALL_PHOTO_DEFS.forEach((def) => {
        const photo = photos[def.id];
        const meta = metaBySlot[def.id] || {};
        const state = photoState[def.id];
        if (photo && photo.blob instanceof Blob) {
          state.blob = photo.blob;
          state.fileName = photo.fileName || meta.fileName || "";
          state.mimeType = photo.mimeType || photo.blob.type || "";
          state.size = typeof photo.size === "number" ? photo.size : photo.blob.size;
          state.lastModified = typeof photo.lastModified === "number" ? photo.lastModified : meta.lastModified;
          state.registered = true;
          state.missingBlob = false;
          try { state.objectUrl = URL.createObjectURL(photo.blob); state.previewFailed = false; }
          catch (_) { state.objectUrl = null; state.previewFailed = true; }
        } else if (meta.registered) {
          state.registered = true;
          state.missingBlob = true;
          state.fileName = meta.fileName || "";
          state.mimeType = meta.mimeType || "";
          state.size = meta.size == null ? null : meta.size;
          state.lastModified = meta.lastModified == null ? null : meta.lastModified;
        }
      });

      const wf = snap.workflow || {};
      if (wf.phaseStatus && typeof wf.phaseStatus === "object") {
        PHASES.forEach((p) => { if (wf.phaseStatus[p]) phaseStatus[p] = wf.phaseStatus[p]; });
      }
      switchPhase(wf.currentPhase || "survey", { silent: true });
      pendingPhotoOps.clear();
      renderAll();
    } finally {
      suppressDirty = false;
    }
  }

  function getPendingPhotoOps(caseId, options) {
    const maxGeneration = options && typeof options.maxGeneration === "number" ? options.maxGeneration : Number.POSITIVE_INFINITY;
    const now = nowIso();
    const photoPuts = [];
    const photoDeletes = [];
    pendingPhotoOps.forEach((op, slotKey) => {
      if (!op || op.generation > maxGeneration) return;
      if (op.type === "put") {
        if (!(op.blob instanceof Blob)) return;
        const meta = op.metadata || {};
        photoPuts.push({
          caseId, slotKey, generation: op.generation, phase: meta.phase || "survey", blob: op.blob,
          fileName: meta.fileName || "", mimeType: meta.mimeType || op.blob.type || "",
          size: meta.size, lastModified: meta.lastModified, createdAt: now, updatedAt: now,
        });
      } else if (op.type === "delete") {
        photoDeletes.push({ caseId, slotKey, generation: op.generation });
      }
    });
    return { photoPuts, photoDeletes };
  }
  function exportAllPhotoPuts() {
    const now = nowIso();
    return ALL_PHOTO_DEFS.map((def) => {
      const state = photoState[def.id];
      if (!state || !(state.blob instanceof Blob)) return null;
      return {
        slotKey: def.id, phase: def.phase || "survey", blob: state.blob, fileName: state.fileName || "",
        mimeType: state.mimeType || state.blob.type || "", size: state.size, lastModified: state.lastModified,
        createdAt: now, updatedAt: now,
      };
    }).filter(Boolean);
  }
  function markAllPhotosDeleted() {
    const generation = notePersistableChangeForPhoto();
    ALL_PHOTO_DEFS.forEach((def) => pendingPhotoOps.set(def.id, { type: "delete", generation }));
  }
  function clearPendingPhotoOps(savedPuts, savedDeletes) {
    if (!savedPuts && !savedDeletes) { pendingPhotoOps.clear(); return false; }
    (savedPuts || []).forEach((saved) => {
      if (!saved || !saved.slotKey) return;
      const cur = pendingPhotoOps.get(saved.slotKey);
      if (cur && cur.type === "put" && cur.generation === saved.generation) pendingPhotoOps.delete(saved.slotKey);
    });
    (savedDeletes || []).forEach((saved) => {
      if (!saved || !saved.slotKey) return;
      const cur = pendingPhotoOps.get(saved.slotKey);
      if (cur && cur.type === "delete" && cur.generation === saved.generation) pendingPhotoOps.delete(saved.slotKey);
    });
    return pendingPhotoOps.size > 0;
  }
  function hasPendingPhotoOps() { return pendingPhotoOps.size > 0; }
  function initEmptyUi() {
    suppressDirty = true;
    try {
      site = emptySite();
      switchPhase("survey", { silent: true });
      renderAll();
    } finally {
      suppressDirty = false;
    }
  }

  function switchPhase(phase, { silent } = {}) {
    if (!PHASES.includes(phase)) phase = "survey";
    const changed = currentPhase !== phase;
    currentPhase = phase;
    document.querySelectorAll(".phase-btn").forEach((btn) => {
      btn.setAttribute("aria-selected", String(btn.getAttribute("data-phase") === phase));
    });
    ["survey", "preparation", "execution", "completion"].forEach((p) => {
      const sec = el("phase-" + p);
      if (sec) sec.hidden = p !== phase;
    });
    if (changed && !silent) {
      if (phaseStatus[phase] === "未着手") phaseStatus[phase] = "入力中";
      notifyDirty();
    }
    renderCta();
  }

  function switchView(view) {
    currentView = view === "estimate" ? "estimate" : "field";
    el("tab-field").setAttribute("aria-selected", String(currentView === "field"));
    el("tab-estimate").setAttribute("aria-selected", String(currentView === "estimate"));
    el("view-field").hidden = currentView !== "field";
    el("view-estimate").hidden = currentView !== "field" ? false : true;
    el("view-estimate").hidden = currentView !== "estimate";
    if (currentView === "estimate") {
      quoteState = window.BCEstimate.loadState();
      renderEstimate();
    }
    renderCta();
    history.replaceState(null, "", currentView === "estimate" ? "?view=estimate" : "?view=field");
  }

  function setSite(key, value) {
    site[key] = value;
    if (key === "workType") applyWorkTypeDefaults(value);
    if (phaseStatus.survey === "未着手") phaseStatus.survey = "入力中";
    renderSurvey();
    notifyDirty();
  }

  function stepper(id, value, unit, step, min, onChange) {
    const v = Number(value) || 0;
    return `<div class="stepper" data-stepper="${id}">
      <button type="button" class="step-btn" data-delta="${-step}">−</button>
      <b>${formatQty(v, unit)}<span class="unit">${unit}</span></b>
      <button type="button" class="step-btn" data-delta="${step}">＋</button>
    </div>`;
  }
  function formatQty(v, unit) {
    if (unit === "m") return String(Math.round(v * 10) / 10);
    return String(v);
  }
  function segs(name, options, current) {
    return `<div class="seg-row">${options.map((opt) => {
      const value = typeof opt === "string" ? opt : opt.value;
      const label = typeof opt === "string" ? opt : opt.label;
      return `<button type="button" class="seg" data-key="${name}" data-value="${escapeAttr(value)}" aria-pressed="${current === value}">${escapeHtml(label)}</button>`;
    }).join("")}</div>`;
  }

  function renderSurvey() {
    const grid = el("work-type-grid");
    if (grid) {
      grid.innerHTML = WORK_TYPES.map((w) =>
        `<button type="button" class="choice-card" data-work="${escapeAttr(w.value)}" aria-pressed="${site.workType === w.value}">${escapeHtml(w.label)}<small>${escapeHtml(w.hint)}</small></button>`
      ).join("");
    }
    const box = el("survey-questions");
    if (!box) return;
    if (!site.workType) {
      box.innerHTML = `<p class="hint">作業を選ぶと、必要な確認だけ出ます。分からなければ「不明」で進められます。</p>`;
      renderPhotos();
      renderAiSuggestions();
      renderFieldExtras();
      return;
    }

    let html = "";
    if (isAcWork()) {
      html += `<p class="section-label">台数</p>
        <div class="step-block"><div class="lbl">取付</div>${stepper("installCount", site.installCount, "台", 1, 0)}</div>
        <div class="step-block"><div class="lbl">取外し</div>${stepper("removeCount", site.removeCount, "台", 1, 0)}</div>`;
      html += `<p class="section-label">電源</p>${segs("acVoltage", ["100V", "200V", "不明"], site.acVoltage)}`;
    }
    html += `<p class="section-label">専用回路</p>${segs("dedicatedCircuit", ["あり", "なし", "不明"], site.dedicatedCircuit)}`;

    if (needsDedicatedFollowup()) {
      html += `<p class="section-label">配線</p>${segs("wiringRoute", WIRING_OPTIONS, site.wiringRoute)}`;
      html += `<p class="section-label">総配線距離</p>
        <p class="hint">分電盤から室外機までの全体の長さです。追加料金の分ではありません。</p>
        ${segs("wireDistancePreset", [
          { value: "unknown", label: "未確認" },
          { value: "5", label: "5m" },
          { value: "10", label: "10m" },
          { value: "15", label: "15m" },
          { value: "20", label: "20m" },
          { value: "other", label: "その他" },
        ], wireDistancePreset())}`;
      if (wireDistancePreset() === "other") {
        html += `<div class="step-block" style="margin-top:8px">${stepper("wireDistance", site.wireDistance || 0, "m", 0.5, 0)}</div>`;
      }
      html += `<p class="section-label">追加料金になる配線延長</p>
        <p class="hint">総配線距離ではなく、追加料金になる分だけ</p>
        ${segs("billableWirePreset", [
          { value: "0", label: "なし" },
          { value: "5", label: "5m" },
          { value: "10", label: "10m" },
          { value: "15", label: "15m" },
          { value: "20", label: "20m" },
          { value: "other", label: "その他" },
        ], billablePreset())}`;
      if (billablePreset() === "other") {
        html += `<div class="step-block" style="margin-top:8px">${stepper("billableWireM", site.billableWireM || 0, "m", 0.5, 0)}</div>`;
      }
    }

    if (isAcWork() || site.workType === "電圧切替を含む可能性") {
      html += `<p class="section-label">電圧切替</p>${segs("voltChange", ["必要", "不要", "不明"], site.voltChange)}`;
    }
    if (isAcWork()) {
      html += `<p class="section-label">室外機の設置場所</p>${segs("outdoorPlace", PLACE_OPTIONS.map((x) => ({ value: x, label: x })), site.outdoorPlace)}`;
      html += `<p class="section-label">穴あけ</p>${segs("hole", ["なし", "あり", "不明"], site.hole)}`;
      if (site.hole === "あり") {
        html += `<div class="step-block" style="margin-top:8px"><div class="lbl">箇所</div>${stepper("holeCount", site.holeCount || 1, "箇所", 1, 1)}</div>`;
      }
      html += `<p class="section-label">化粧カバー</p>${segs("cover", ["なし", "あり", "不明"], site.cover)}`;
      if (site.cover === "あり") {
        html += `<p class="hint">長さは材料の目安です。見積は「化粧カバー追加」1式です。</p>
          ${segs("coverLenPreset", [
            { value: "unknown", label: "未確認" },
            { value: "1", label: "1m" },
            { value: "2", label: "2m" },
            { value: "3", label: "3m" },
            { value: "4", label: "4m" },
            { value: "other", label: "その他" },
          ], coverLenPreset())}`;
        if (coverLenPreset() === "other") {
          html += `<div class="step-block" style="margin-top:8px">${stepper("coverLengthM", site.coverLengthM || 0, "m", 0.5, 0)}</div>`;
        }
      }
      html += `<p class="section-label">追加配管</p>
        ${segs("pipePreset", [
          { value: "0", label: "なし" },
          { value: "1", label: "+1m" },
          { value: "2", label: "+2m" },
          { value: "3", label: "+3m" },
          { value: "4", label: "+4m" },
          { value: "other", label: "その他" },
        ], pipePreset())}`;
      if (pipePreset() === "other") {
        html += `<div class="step-block" style="margin-top:8px">${stepper("pipeExtM", site.pipeExtM || 0, "m", 0.5, 0)}</div>`;
      }
    }

    box.innerHTML = html;
    renderPhotos();
    renderAiSuggestions();
    renderFieldExtras();
  }

  function wireDistancePreset() {
    if (site.wireDistanceUnknown || site.wireDistance == null) return "unknown";
    const n = Number(site.wireDistance);
    if ([5, 10, 15, 20].includes(n)) return String(n);
    return "other";
  }
  function billablePreset() {
    const n = Number(site.billableWireM) || 0;
    if (n === 0) return "0";
    if ([5, 10, 15, 20].includes(n)) return String(n);
    return "other";
  }
  function pipePreset() {
    const n = Number(site.pipeExtM) || 0;
    if (n === 0) return "0";
    if ([1, 2, 3, 4].includes(n)) return String(n);
    return "other";
  }
  function coverLenPreset() {
    if (site.coverLengthM == null || site.coverLengthM === "") return "unknown";
    const n = Number(site.coverLengthM);
    if ([1, 2, 3, 4].includes(n)) return String(n);
    return "other";
  }

  function renderFieldExtras() {
    const built = window.BCEstimate.buildFieldLines(site);
    fieldNotices = built.notices;
    fieldMaterials = built.materials;
    const nbox = el("survey-notices");
    const mbox = el("survey-materials");
    if (nbox) {
      nbox.innerHTML = built.notices.map((n) => `<div class="notice"><b>${escapeHtml(n.title)}</b>${escapeHtml(n.detail)}</div>`).join("");
    }
    if (mbox) {
      if (!built.materials.length) { mbox.innerHTML = ""; return; }
      mbox.innerHTML = `<div class="materials"><b>準備する材料</b><ul>${built.materials.map((m) =>
        `<li>${escapeHtml(m.name)}　${m.qty == null ? "数量は現地" : escapeHtml(m.qty) + escapeHtml(m.unit || "")}　${escapeHtml(m.note || "確認が必要")}</li>`
      ).join("")}</ul><p class="hint">電線サイズ・遮断器定格・施工可否は自動では決めません。</p></div>`;
    }
  }

  function photoCardHtml(def) {
    const state = photoState[def.id];
    const has = isPhotoPresent(state);
    let thumb = "未選択";
    if (state.missingBlob) thumb = "再登録が必要";
    else if (state.previewFailed) thumb = "プレビュー不可";
    else if (state.objectUrl) thumb = `<img alt="${escapeAttr(def.title)}" src="${state.objectUrl}">`;
    const rt = getAiMockRuntime(def.id);
    const canAi = SURVEY_PHOTO_IDS.has(def.id);
    return `<article class="photo-card" data-photo-id="${def.id}">
      <div class="thumb">${thumb}</div>
      <div class="body">
        <div class="name">${escapeHtml(def.title)}</div>
        <div class="actions">
          <button type="button" class="mini-btn primary" data-action="pick">${has ? "差し替え" : "追加"}</button>
          <button type="button" class="mini-btn" data-action="remove" ${has ? "" : "disabled"}>消す</button>
        </div>
        ${canAi ? `<button type="button" class="mini-btn" data-action="ai-mock" style="width:100%">${rt.busy ? "読取中…" : "写真AIで読む"}</button>` : ""}
        ${rt.error ? `<p class="hint">${escapeHtml(rt.error)}</p>` : ""}
      </div>
      <input class="file-hidden" type="file" accept="image/*" data-action="file-library">
      <input class="file-hidden" type="file" accept="image/*" capture="environment" data-action="file-camera">
    </article>`;
  }

  function renderPhotos() {
    const survey = el("photo-cards");
    if (survey) {
      const main = PHOTO_DEFS.filter((d) => d.group === "survey" || showMorePhotos);
      const extraBtn = showMorePhotos
        ? `<button type="button" class="info-link" id="toggle-more-photos">写真を減らす</button>`
        : `<button type="button" class="info-link" id="toggle-more-photos">分電盤の詳細写真など</button>`;
      survey.innerHTML = main.map(photoCardHtml).join("") + extraBtn;
    }
    const exec = el("exec-photo-cards");
    if (exec) exec.innerHTML = EXEC_PHOTO_DEFS.map(photoCardHtml).join("");
    const comp = el("comp-photo-cards");
    if (comp) comp.innerHTML = COMP_PHOTO_DEFS.map(photoCardHtml).join("");
  }

  function bindPhotoRoot(root) {
    if (!root) return;
    root.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.id === "toggle-more-photos") {
        showMorePhotos = !showMorePhotos;
        renderPhotos();
        return;
      }
      const card = target.closest("[data-photo-id]");
      if (!(card instanceof HTMLElement)) return;
      const id = card.getAttribute("data-photo-id");
      if (target.closest('[data-action="pick"]')) {
        openPhotoPicker(id);
        return;
      }
      if (target.closest('[data-action="ai-mock"]')) {
        void runAiReading(id);
        return;
      }
      if (target.closest('[data-action="remove"]')) {
        revokePhoto(id);
        clearAiMock(id);
        markPhotoDelete(id);
        renderPhotos();
        renderAiSuggestions();
        notifyDirty();
      }
    });
    root.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.type !== "file") return;
      const card = target.closest("[data-photo-id]");
      if (!(card instanceof HTMLElement)) return;
      const id = card.getAttribute("data-photo-id");
      const file = target.files && target.files[0];
      if (!file) return;
      setPhotoFromFile(id, file);
      target.value = "";
    });
  }

  function openPhotoPicker(id) {
    pickerSlot = id;
    const overlay = el("info-overlay");
    const content = el("info-content");
    content.innerHTML = `<h2 class="q">写真を追加</h2>
      <div class="menu-list">
        <button type="button" class="btn btn-primary" id="pick-camera">撮影する</button>
        <button type="button" class="btn btn-secondary" id="pick-library">写真から選ぶ</button>
      </div>`;
    overlay.hidden = false;
    el("pick-camera").onclick = () => {
      overlay.hidden = true;
      triggerFile(id, "file-camera");
    };
    el("pick-library").onclick = () => {
      overlay.hidden = true;
      triggerFile(id, "file-library");
    };
  }
  function triggerFile(id, action) {
    const card = document.querySelector(`[data-photo-id="${id}"]`);
    const input = card && card.querySelector(`[data-action="${action}"]`);
    if (input instanceof HTMLInputElement) {
      input.value = "";
      input.click();
    }
  }

  function setPhotoFromFile(id, file) {
    if (!file) { window.alert("画像ファイルを選択してください。"); return; }
    const mime = String(file.type || "").toLowerCase();
    if (BLOCKED_IMAGE_TYPES.has(mime) || (!mime.startsWith("image/") && mime !== "")) {
      window.alert("JPEG / PNG / WebP / HEIC / HEIF を選択してください。");
      return;
    }
    if (mime && !ALLOWED_IMAGE_TYPES.has(mime) && mime.startsWith("image/")) {
      window.alert("JPEG / PNG / WebP / HEIC / HEIF を選択してください。");
      return;
    }
    revokePhoto(id);
    const state = photoState[id];
    state.blob = file;
    state.objectUrl = URL.createObjectURL(file);
    state.fileName = file.name || "選択済み画像";
    state.mimeType = file.type || "";
    state.size = typeof file.size === "number" ? file.size : null;
    state.lastModified = typeof file.lastModified === "number" ? file.lastModified : null;
    state.registered = true;
    state.previewFailed = false;
    state.missingBlob = false;
    clearAiMock(id);
    markPhotoPut(id);
    renderPhotos();
    renderAiSuggestions();
  }

  function mapAiErrorMessage(status, code, message) {
    if (code === "model_timeout" || status === 504) return "写真AIの応答が時間切れです。写真は端末に残っています。";
    if (status === 401 || status === 403) return "写真AIを使うには、BCアカウントのログインが必要です。";
    return message || "写真AIを読めませんでした。写真は端末に残っています。";
  }

  async function runAiReading(id) {
    if (!SURVEY_PHOTO_IDS.has(id)) return;
    const state = photoState[id];
    if (!isPhotoPresent(state) || !isJpegPhoto(state)) {
      const rt = getAiMockRuntime(id);
      rt.error = "JPEG写真を追加してから実行してください。";
      renderPhotos();
      return;
    }
    if (typeof state.size === "number" && state.size > AI_JPEG_MAX_BYTES) {
      getAiMockRuntime(id).error = "写真は4MB以下のJPEGにしてください";
      renderPhotos();
      return;
    }
    if (!isAiLoggedIn()) {
      getAiMockRuntime(id).error = "写真AIにはログインが必要です。";
      renderPhotos();
      openAiAuth();
      return;
    }
    const rt = getAiMockRuntime(id);
    if (rt.busy) return;
    if (rt.cooldownUntil && Date.now() < rt.cooldownUntil) return;
    if (!window.confirm(AI_CONSENT_MESSAGE)) return;

    const auth = window.BCFDAiAuth;
    const token = auth && typeof auth.getAccessToken === "function" ? auth.getAccessToken() : "";
    const proxyUrl = auth && auth.AI_PHOTO_PROXY_URL;
    const anon = auth && auth.SUPABASE_ANON_KEY;
    if (!token || !proxyUrl || !anon) {
      rt.error = "BCアカウントでログインしてください";
      renderPhotos();
      return;
    }
    rt.busy = true; rt.error = ""; rt.candidate = null;
    renderPhotos();
    const controller = new AbortController();
    const clientTimer = window.setTimeout(() => controller.abort(), AI_CLIENT_TIMEOUT_MS);
    try {
      const form = new FormData();
      form.append("slotKey", id);
      form.append("photo", state.blob, state.fileName && /\.jpe?g$/i.test(state.fileName) ? state.fileName : "photo.jpg");
      const res = await fetch(proxyUrl, {
        method: "POST",
        headers: { Authorization: "Bearer " + token, apikey: anon },
        body: form,
        signal: controller.signal,
      });
      let data = null;
      try { data = await res.json(); } catch (_) { data = null; }
      if (!res.ok || !data || data.ok !== true) {
        rt.error = mapAiErrorMessage(res.status, data && data.code, data && data.message);
        rt.candidate = null;
        return;
      }
      if (!data.reading || data.status !== "suggested") {
        rt.error = "写真AIの結果を安全に表示できませんでした。現場で確認してください。";
        rt.candidate = null;
        return;
      }
      const def = PHOTO_DEFS.find((p) => p.id === id);
      rt.candidate = { source: "openai", status: "suggested", slotTitle: (def && def.title) || id, reading: data.reading };
      rt.error = "";
      ingestAiReading(id, data.reading);
    } catch (err) {
      const aborted = (err && err.name === "AbortError") || controller.signal.aborted;
      rt.error = aborted
        ? "55秒以内に応答がありませんでした。写真は保存されていません。自動再送はしていません。"
        : "通信が切れました。写真は端末に残っています。";
      rt.candidate = null;
    } finally {
      window.clearTimeout(clientTimer);
      rt.busy = false;
      rt.cooldownUntil = Date.now() + AI_COOLDOWN_MS;
      renderPhotos();
      renderAiSuggestions();
    }
  }

  function ingestAiReading(slotId, reading) {
    const texts = [];
    if (reading && reading.summary) texts.push(String(reading.summary));
    (reading.candidates || []).forEach((c) => {
      if (c && c.label) texts.push(String(c.label));
      if (c && c.value) texts.push(String(c.value));
    });
    (reading.evidence || []).forEach((e) => { if (e && e.text) texts.push(String(e.text)); });
    const blob = texts.join(" ");
    const add = (key, label, apply) => {
      if (aiSuggestions.some((s) => s.key === key && s.status === "pending")) return;
      aiSuggestions.push({ id: slotId + "-" + key, slotId, key, label, apply, status: "pending" });
    };
    if (/穴あけ|貫通/.test(blob) && site.hole !== "あり") add("hole", "穴あけあり", () => { site.hole = "あり"; if (!site.holeCount) site.holeCount = 1; });
    if (/専用回路.{0,6}なし|専用.*無い|空き回路.{0,4}なし/.test(blob) && site.dedicatedCircuit !== "なし") {
      add("dedicated-none", "専用回路なし", () => { site.dedicatedCircuit = "なし"; });
    }
    if (/屋根/.test(blob) && site.outdoorPlace !== "屋根") add("roof", "屋根置き", () => { site.outdoorPlace = "屋根"; });
    if (/壁面|壁掛け/.test(blob) && site.outdoorPlace !== "壁面") add("wall", "壁面設置", () => { site.outdoorPlace = "壁面"; });
    if (/化粧カバー/.test(blob) && site.cover !== "あり") add("cover", "化粧カバーあり", () => { site.cover = "あり"; });
    if (/\b100V\b|１００Ｖ/.test(blob) && site.acVoltage !== "100V") add("v100", "100V", () => { site.acVoltage = "100V"; });
    if (/\b200V\b|２００Ｖ/.test(blob) && site.acVoltage !== "200V") add("v200", "200V", () => { site.acVoltage = "200V"; });
  }

  function renderAiSuggestions() {
    const box = el("ai-suggestions");
    if (!box) return;
    const pending = aiSuggestions.filter((s) => s.status === "pending");
    box.innerHTML = pending.map((s) =>
      `<div class="ai-card" data-sug="${escapeAttr(s.id)}">
        <b>AI読取・要確認</b>
        <p>「${escapeHtml(s.label)}」に見えます</p>
        <div class="ai-actions">
          <button type="button" class="btn btn-primary" data-ai="apply">反映する</button>
          <button type="button" class="btn btn-secondary" data-ai="reject">違う</button>
        </div>
      </div>`
    ).join("");
  }

  function renderPrep() {
    const fields = el("prep-fields");
    if (fields) {
      fields.innerHTML = `
        <label class="section-label">作業の要点</label><textarea class="text-input" data-prep="workSummary">${escapeHtml(prepText.workSummary)}</textarea>
        <label class="section-label">作業者</label><input class="field-input" data-prep="worker" value="${escapeAttr(prepText.worker)}">
        <label class="section-label">責任者</label><input class="field-input" data-prep="supervisor" value="${escapeAttr(prepText.supervisor)}">
        <p class="section-label">開始の判断</p>${segs("prepStartState", ["未判定", "担当者確認待ち", "責任者確認済み", "作業停止"], prepStartState)}
        <label class="section-label">メモ</label><textarea class="text-input" data-prep="memo">${escapeHtml(prepText.memo)}</textarea>
      `;
    }
    renderChecks(el("prep-checks"), prepChecks, "prep");
  }
  function renderExec() {
    const fields = el("exec-fields");
    if (fields) {
      fields.innerHTML = `<p class="section-label">状態</p>${segs("execState", ["未着手", "作業中", "中断", "施工記録済み"], execState)}
        <p class="section-label">計画変更</p>${segs("planChange", ["未確認", "変更なし", "変更あり"], planChange.state)}
        ${planChange.state === "変更あり" ? `<label class="section-label">変更内容</label><textarea class="text-input" id="change-after">${escapeHtml(planChange.after)}</textarea>` : ""}
        <label class="section-label">メモ</label><textarea class="text-input" id="exec-memo">${escapeHtml(execMemo)}</textarea>`;
    }
    renderPhotos();
  }
  function renderComp() {
    const fields = el("comp-fields");
    if (fields) {
      fields.innerHTML = `<p class="section-label">引き渡し</p>${segs("handoverState", ["未判定", "担当者確認待ち", "責任者確認済み", "要対応・保留"], handoverState)}
        <label class="section-label">メモ</label><textarea class="text-input" id="comp-memo">${escapeHtml(compMemo)}</textarea>`;
    }
    renderChecks(el("comp-checks"), operationChecks, "op");
    renderPhotos();
  }
  function renderChecks(container, rows, prefix) {
    if (!container) return;
    container.innerHTML = rows.map((row) =>
      `<div class="check-row" data-check="${prefix}:${row.key}">
        <div>${escapeHtml(row.label)}</div>
        <div class="check-states">${CHECK_STATES.map((st) =>
          `<button type="button" aria-pressed="${row.state === st}">${escapeHtml(st)}</button>`
        ).join("")}</div>
      </div>`
    ).join("");
  }

  function renderEstimate() {
    const E = window.BCEstimate;
    quoteState = E.loadState();
    if (el("est-customer")) el("est-customer").value = quoteState.customer || "";
    if (el("est-memo")) el("est-memo").value = quoteState.memo || "";
    const cats = el("est-cats");
    cats.innerHTML = E.initialCatalog.map((c) =>
      `<button type="button" class="cat-tab" data-cat="${escapeAttr(c.category)}" aria-selected="${estCategory === c.category}">${escapeHtml(c.category)}</button>`
    ).join("");
    const cat = E.initialCatalog.find((c) => c.category === estCategory) || E.initialCatalog[0];
    const box = el("est-catalog");
    box.innerHTML = cat.items.map((item) => {
      const st = quoteState.selected[item.id] || { checked: false, qty: 1 };
      const price = E.getPrice(quoteState, item);
      const amt = st.checked ? price * Number(st.qty || 0) : 0;
      return `<button type="button" class="est-item" data-item="${item.id}" aria-pressed="${st.checked}">
        <div><div class="name">${escapeHtml(item.name)}</div><div class="meta">${E.yen(price)} / ${escapeHtml(item.unit)}</div></div>
        <div class="amt">${st.checked ? E.yen(amt) : ""}</div>
        ${st.checked ? stepper("qty:" + item.id, st.qty, item.unit, item.unit === "m" ? 0.5 : 1, 0) : ""}
      </button>`;
    }).join("");
    const sel = el("est-selected");
    const rows = E.selectedRows(quoteState);
    sel.innerHTML = rows.length
      ? rows.map((r) => `<div class="check-row"><div><b>${escapeHtml(r.name)}</b><div class="hint">${E.yen(r.price)} × ${r.qty}${escapeHtml(r.unit)}</div></div><div class="amt">${E.yen(r.price * r.qty)}</div></div>`).join("")
      : `<p class="hint">まだ選んでいません。</p>`;
    const nbox = el("est-notices");
    nbox.innerHTML = fieldNotices.map((n) => `<div class="notice"><b>${escapeHtml(n.title)}</b>${escapeHtml(n.detail)}</div>`).join("");
    const mbox = el("est-materials");
    mbox.innerHTML = fieldMaterials.length
      ? `<div class="materials"><b>準備する材料</b><ul>${fieldMaterials.map((m) =>
          `<li>${escapeHtml(m.name)}　${m.qty == null ? "数量は現地" : escapeHtml(m.qty) + escapeHtml(m.unit || "")}　${escapeHtml(m.note || "確認が必要")}</li>`
        ).join("")}</ul></div>`
      : "";
    renderCta();
  }

  function renderPriceList() {
    const E = window.BCEstimate;
    const box = el("price-list");
    box.innerHTML = E.initialCatalog.map((cat) =>
      `<p class="section-label">${escapeHtml(cat.category)}</p>` +
      cat.items.map((item) =>
        `<label class="section-label" for="price-${item.id}">${escapeHtml(item.name)}</label>
         <input class="field-input price-edit" id="price-${item.id}" data-price-id="${item.id}" type="number" inputmode="decimal" value="${E.getPrice(quoteState, item)}">`
      ).join("")
    ).join("");
  }

  function renderCta() {
    const inner = el("cta-inner");
    if (!inner) return;
    if (currentView === "estimate") {
      const t = window.BCEstimate.totals(quoteState);
      inner.innerHTML = `<div class="cta-sum"><span class="count">選択中 ${t.count}件</span><span class="total">${window.BCEstimate.yen(t.total)}</span></div>
        <div class="cta-actions">
          <button type="button" class="btn btn-secondary" id="cta-details">明細を見る</button>
          <button type="button" class="btn btn-primary" id="cta-copy">コピー</button>
        </div>`;
    } else {
      inner.innerHTML = `<button type="button" class="cta-main" id="cta-to-estimate">見積へ</button>`;
    }
  }

  function goToEstimateFromField() {
    const E = window.BCEstimate;
    const built = E.buildFieldLines(site);
    fieldNotices = built.notices;
    fieldMaterials = built.materials;
    quoteState = E.loadState();
    const caseName = (el("case-name") && el("case-name").value.trim()) || "";
    const noteBits = [];
    if (site.workType) noteBits.push("作業：" + displayWorkType(site.workType));
    if (site.outdoorPlace) noteBits.push("室外機：" + site.outdoorPlace);
    quoteState = E.mergeLinesIntoState(quoteState, built.lines, {
      customer: caseName,
      note: noteBits.join(" / "),
    });
    if (built.lines.some((l) => ["install_std", "remove_std", "remove_floor", "pipe_ext", "cover", "roof_wall"].includes(l.id))) {
      estCategory = "エアコン工事";
    } else if (built.lines.some((l) => ["dedicated", "volt_change", "hole", "wire_ext"].includes(l.id))) {
      estCategory = "軽い電気工事";
    }
    E.saveState(quoteState);
    switchView("estimate");
  }

  function displayWorkType(v) {
    const w = WORK_TYPES.find((x) => x.value === v);
    return w ? w.label : v;
  }

  function toggleItem(id) {
    const E = window.BCEstimate;
    if (!quoteState.selected[id]) quoteState.selected[id] = { checked: false, qty: 1 };
    quoteState.selected[id].checked = !quoteState.selected[id].checked;
    if (!quoteState.selected[id].qty) quoteState.selected[id].qty = 1;
    E.saveState(quoteState);
    renderEstimate();
  }
  function changeQty(id, delta, min, step) {
    const E = window.BCEstimate;
    if (!quoteState.selected[id]) quoteState.selected[id] = { checked: true, qty: 1 };
    let next = Number(quoteState.selected[id].qty || 0) + delta;
    next = Math.max(min, Math.round(next / step) * step);
    quoteState.selected[id].qty = next;
    if (next <= 0) {
      quoteState.selected[id].checked = false;
      quoteState.selected[id].qty = step;
    } else {
      quoteState.selected[id].checked = true;
    }
    E.saveState(quoteState);
    renderEstimate();
  }

  function handleSurveyClick(event) {
    const t = event.target;
    if (!(t instanceof Element)) return;
    const work = t.closest("[data-work]");
    if (work) { setSite("workType", work.getAttribute("data-work")); return; }
    const seg = t.closest(".seg");
    if (seg) {
      const key = seg.getAttribute("data-key");
      const value = seg.getAttribute("data-value");
      if (key === "wireDistancePreset") {
        if (value === "unknown") { site.wireDistanceUnknown = true; site.wireDistance = null; }
        else if (value === "other") { site.wireDistanceUnknown = false; if (site.wireDistance == null) site.wireDistance = 0; }
        else { site.wireDistanceUnknown = false; site.wireDistance = Number(value); }
        renderSurvey(); notifyDirty(); return;
      }
      if (key === "billableWirePreset") {
        site.billableWireM = value === "other" ? (site.billableWireM || 0.5) : Number(value);
        renderSurvey(); notifyDirty(); return;
      }
      if (key === "pipePreset") {
        site.pipeExtM = value === "other" ? (site.pipeExtM || 0.5) : Number(value);
        renderSurvey(); notifyDirty(); return;
      }
      if (key === "coverLenPreset") {
        if (value === "unknown") site.coverLengthM = null;
        else if (value === "other") site.coverLengthM = site.coverLengthM || 0.5;
        else site.coverLengthM = Number(value);
        renderSurvey(); notifyDirty(); return;
      }
      if (key === "prepStartState") { prepStartState = value; renderPrep(); notifyDirty(); return; }
      if (key === "execState") { execState = value; renderExec(); notifyDirty(); return; }
      if (key === "planChange") { planChange.state = value; renderExec(); notifyDirty(); return; }
      if (key === "handoverState") { handoverState = value; renderComp(); notifyDirty(); return; }
      setSite(key, value);
      if (key === "hole" && value === "あり" && !site.holeCount) site.holeCount = 1;
      renderSurvey();
      return;
    }
    const stepBtn = t.closest(".step-btn");
    if (stepBtn) {
      const stepperEl = stepBtn.closest("[data-stepper]");
      const id = stepperEl && stepperEl.getAttribute("data-stepper");
      const delta = Number(stepBtn.getAttribute("data-delta"));
      if (id && id.startsWith("qty:")) {
        const itemId = id.slice(4);
        const item = window.BCEstimate.itemById[itemId];
        changeQty(itemId, delta, 0, item && item.unit === "m" ? 0.5 : 1);
        return;
      }
      if (id === "installCount") site.installCount = Math.max(0, (Number(site.installCount) || 0) + delta);
      if (id === "removeCount") site.removeCount = Math.max(0, (Number(site.removeCount) || 0) + delta);
      if (id === "holeCount") site.holeCount = Math.max(1, (Number(site.holeCount) || 1) + delta);
      if (id === "pipeExtM") site.pipeExtM = Math.max(0, roundStep((Number(site.pipeExtM) || 0) + delta, 0.5));
      if (id === "billableWireM") site.billableWireM = Math.max(0, roundStep((Number(site.billableWireM) || 0) + delta, 0.5));
      if (id === "wireDistance") { site.wireDistanceUnknown = false; site.wireDistance = Math.max(0, roundStep((Number(site.wireDistance) || 0) + delta, 0.5)); }
      if (id === "coverLengthM") site.coverLengthM = Math.max(0, roundStep((Number(site.coverLengthM) || 0) + delta, 0.5));
      renderSurvey();
      notifyDirty();
    }
  }

  function roundStep(n, step) { return Math.round(n / step) * step; }

  function renderAll() {
    renderSurvey();
    renderPrep();
    renderExec();
    renderComp();
    if (currentView === "estimate") renderEstimate();
    renderCta();
  }

  function escapeHtml(v) {
    return String(v ?? "").replace(/[&<>'"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch]));
  }
  function escapeAttr(v) { return escapeHtml(v); }

  function openMore() { el("more-overlay").hidden = false; }
  function closeMore() { el("more-overlay").hidden = true; }
  function openAiAuth() {
    el("ai-auth-panel").hidden = false;
    window.scrollTo({ top: el("ai-auth-panel").offsetTop - 12, behavior: "smooth" });
  }

  function initAiAuthUi() {
    const auth = window.BCFDAiAuth;
    const signedOut = el("ai-auth-signed-out");
    const signedIn = el("ai-auth-signed-in");
    const recoveryPanel = el("ai-auth-recovery");
    const emailInput = el("ai-auth-email");
    const passwordInput = el("ai-auth-password");
    const newPasswordInput = el("ai-auth-new-password");
    const newPasswordConfirm = el("ai-auth-new-password-confirm");
    const loginBtn = el("ai-auth-login-btn");
    const resetBtn = el("ai-auth-reset-btn");
    const savePasswordBtn = el("ai-auth-save-password-btn");
    const cancelRecoveryBtn = el("ai-auth-cancel-recovery-btn");
    const logoutBtn = el("ai-auth-logout-btn");
    const emailDisplay = el("ai-auth-email-display");
    const errorEl = el("ai-auth-error");
    const infoEl = el("ai-auth-info");
    const recoveryErrorEl = el("ai-auth-recovery-error");
    if (!auth || !signedOut || !signedIn || !recoveryPanel) return;
    function setMessage(node, msg) {
      if (!(node instanceof HTMLElement)) return;
      node.hidden = !msg;
      node.textContent = msg || "";
    }
    function renderAuth() {
      const recovering = typeof auth.isPasswordRecovery === "function" && auth.isPasswordRecovery();
      const session = auth.getSession();
      if (recovering) { signedOut.hidden = true; signedIn.hidden = true; recoveryPanel.hidden = false; return; }
      recoveryPanel.hidden = true;
      if (session && session.email) {
        signedOut.hidden = true; signedIn.hidden = false;
        if (emailDisplay) emailDisplay.textContent = session.email;
      } else {
        signedOut.hidden = false; signedIn.hidden = true;
        if (emailDisplay) emailDisplay.textContent = "";
      }
    }
    async function refreshAuthUi() {
      if (typeof auth.detectPasswordRecoveryFromUrl === "function") {
        try { await auth.detectPasswordRecoveryFromUrl(); } catch (_) { /* ignore */ }
      }
      renderAuth();
    }
    refreshAuthUi();
    auth.onChange(() => { renderAuth(); renderPhotos(); });
    window.addEventListener("hashchange", () => { refreshAuthUi(); });
    loginBtn.addEventListener("click", async () => {
      loginBtn.disabled = true;
      try {
        const result = await auth.signInWithPassword(emailInput.value, passwordInput.value);
        passwordInput.value = "";
        if (!result || result.ok === false) setMessage(errorEl, (result && result.message) || "ログインできませんでした。");
        else { setMessage(errorEl, ""); el("ai-auth-panel").hidden = true; }
      } catch (_) {
        setMessage(errorEl, "ログイン通信に失敗しました。");
      } finally { loginBtn.disabled = false; }
    });
    resetBtn.addEventListener("click", async () => {
      try {
        const result = await auth.requestPasswordReset(emailInput.value);
        setMessage(infoEl, (result && result.message) || "再設定手順を送りました。");
      } catch (_) {
        setMessage(errorEl, "再設定メールを送れませんでした。");
      }
    });
    savePasswordBtn.addEventListener("click", async () => {
      try {
        const result = await auth.updatePassword(newPasswordInput.value, newPasswordConfirm.value);
        if (!result || result.ok === false) setMessage(recoveryErrorEl, (result && result.message) || "更新に失敗しました。");
        else { setMessage(infoEl, result.message || "パスワードを更新しました。"); renderAuth(); }
      } catch (_) {
        setMessage(recoveryErrorEl, "パスワード更新通信に失敗しました。");
      }
    });
    cancelRecoveryBtn.addEventListener("click", () => {
      if (typeof auth.clearRecovery === "function") auth.clearRecovery();
      renderAuth();
    });
    logoutBtn.addEventListener("click", async () => { await auth.signOut(); });
  }

  document.addEventListener("click", (event) => {
    const t = event.target;
    if (!(t instanceof Element)) return;
    if (t.id === "tab-field") { switchView("field"); return; }
    if (t.id === "tab-estimate") { switchView("estimate"); return; }
    if (t.id === "more-menu-btn") { openMore(); return; }
    if (t.id === "close-more-btn" || t.id === "more-overlay") {
      if (t.id === "more-overlay" && event.target !== t) return;
      if (t.id === "more-overlay" && event.target === t) closeMore();
      if (t.id === "close-more-btn") closeMore();
      return;
    }
    if (t.id === "close-info-btn" || t.id === "info-overlay") {
      if (t.id === "info-overlay" && event.target !== t) return;
      el("info-overlay").hidden = true;
      return;
    }
    if (t.id === "open-safety-btn") {
      el("info-content").innerHTML = `<h2 class="q">安全について</h2>
        <p>この結果は写真と入力による参考です。施工可否・電線サイズ・遮断器・接続方法は、有資格者が現地確認・測定後に決めてください。</p>
        <p>分電盤は外から見える範囲だけ撮影してください。保護カバーは外さないでください。</p>`;
      el("info-overlay").hidden = false; closeMore(); return;
    }
    if (t.id === "open-saveinfo-btn") {
      el("info-content").innerHTML = `<h2 class="q">保存について</h2>
        <p>案件と写真はこの端末のブラウザ内に保存されます。クラウドには同期しません。</p>
        <p>バックアップファイルは暗号化されていません。復元は既存案件を上書きせず、新しい案件として追加します。</p>`;
      el("info-overlay").hidden = false; closeMore(); return;
    }
    if (t.id === "open-ai-auth-btn") { closeMore(); openAiAuth(); return; }
    if (t.id === "close-ai-auth-btn") { el("ai-auth-panel").hidden = true; return; }
    if (t.id === "prep-stop-btn" || t.id === "exec-stop-btn") {
      if (stopRecord.active && !stopRecord.resumed) {
        window.alert("すでに作業停止中です。再開の記録を入れてください。");
        return;
      }
      const reason = window.prompt("停止理由を選ぶか入力\n例：" + STOP_REASONS.slice(0, 3).join(" / "));
      if (!reason) return;
      stopRecord = {
        ...createEmptyStopRecord(),
        active: true,
        reason: reason.trim(),
        recordedAt: nowIso(),
        recorder: prepText.worker || "",
      };
      if (t.id === "prep-stop-btn") prepStartState = "作業停止";
      if (t.id === "exec-stop-btn") execState = "中断";
      renderPrep();
      renderExec();
      notifyDirty();
      return;
    }
    if (t.id === "cta-to-estimate") { goToEstimateFromField(); return; }
    if (t.id === "cta-copy") {
      const text = window.BCEstimate.quoteText(quoteState);
      navigator.clipboard.writeText(text).then(() => window.alert("見積文をコピーしました")).catch(() => window.prompt("コピーしてください", text));
      return;
    }
    if (t.id === "cta-details") {
      el("est-selected").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (t.id === "open-prices-btn") { renderPriceList(); el("prices-overlay").hidden = false; return; }
    if (t.id === "close-prices-btn" || t.id === "prices-overlay") {
      if (t.id === "prices-overlay" && event.target !== t) return;
      el("prices-overlay").hidden = true; return;
    }
    if (t.id === "add-custom-btn") {
      const name = el("customName").value.trim();
      const price = Number(el("customPrice").value || 0);
      const qty = Number(el("customQty").value || 1);
      if (!name) { window.alert("作業名を入力してください"); return; }
      quoteState.custom.push({ name, price, qty, unit: "式" });
      el("customName").value = ""; el("customPrice").value = ""; el("customQty").value = "1";
      window.BCEstimate.saveState(quoteState);
      renderEstimate();
      return;
    }
    if (t.id === "copy-prices-btn") {
      const payload = { type: window.BCEstimate.PRICE_MASTER_TYPE, version: 1, prices: window.BCEstimate.effectivePrices(quoteState) };
      const text = JSON.stringify(payload, null, 2);
      el("masterJson").value = text;
      navigator.clipboard.writeText(text).then(() => { el("masterMsg").textContent = "コピーしました。"; }).catch(() => window.prompt("コピーしてください", text));
      return;
    }
    if (t.id === "load-prices-btn") {
      try {
        quoteState.prices = window.BCEstimate.parsePriceMaster(el("masterJson").value.trim());
        window.BCEstimate.saveState(quoteState);
        renderEstimate(); renderPriceList();
        el("masterMsg").textContent = "読み込みました。";
      } catch (err) {
        el("masterMsg").textContent = "読み込みできません：" + (err && err.message ? err.message : "");
      }
      return;
    }
    if (t.id === "reset-prices-btn") {
      if (!window.confirm("料金設定を初期値に戻しますか？ 見積の選択内容は残します。")) return;
      quoteState.prices = {};
      window.BCEstimate.saveState(quoteState);
      renderEstimate(); renderPriceList();
      el("masterMsg").textContent = "初期値に戻しました。";
      return;
    }
    const sug = t.closest("[data-sug]");
    if (sug) {
      const item = aiSuggestions.find((s) => s.id === sug.getAttribute("data-sug"));
      if (item && t.closest('[data-ai="apply"]')) { item.apply(); item.status = "applied"; renderSurvey(); notifyDirty(); }
      if (item && t.closest('[data-ai="reject"]')) { item.status = "rejected"; renderAiSuggestions(); }
      return;
    }
    const cat = t.closest("[data-cat]");
    if (cat) { estCategory = cat.getAttribute("data-cat"); renderEstimate(); return; }
    const itemBtn = t.closest("[data-item]");
    if (itemBtn && !t.closest(".step-btn")) { toggleItem(itemBtn.getAttribute("data-item")); return; }
    const check = t.closest("[data-check]");
    if (check && t.tagName === "BUTTON") {
      const [prefix, key] = check.getAttribute("data-check").split(":");
      const list = prefix === "prep" ? prepChecks : operationChecks;
      const row = list.find((x) => x.key === key);
      if (row) { row.state = t.textContent; if (prefix === "prep") renderPrep(); else renderComp(); notifyDirty(); }
      return;
    }
    const phaseBtn = t.closest(".phase-btn");
    if (phaseBtn) { switchPhase(phaseBtn.getAttribute("data-phase")); return; }
    handleSurveyClick(event);
  });

  document.addEventListener("input", (event) => {
    const t = event.target;
    if (!(t instanceof Element)) return;
    if (t.id === "case-name" || t.id === "site-memo") { notifyDirty(); return; }
    if (t.id === "est-customer") { quoteState.customer = t.value; window.BCEstimate.saveState(quoteState); renderCta(); return; }
    if (t.id === "est-memo") { quoteState.memo = t.value; window.BCEstimate.saveState(quoteState); return; }
    if (t.id === "exec-memo") { execMemo = t.value; notifyDirty(); return; }
    if (t.id === "comp-memo") { compMemo = t.value; notifyDirty(); return; }
    if (t.id === "change-after") { planChange.after = t.value; notifyDirty(); return; }
    if (t.matches("[data-prep]")) { prepText[t.getAttribute("data-prep")] = t.value; notifyDirty(); return; }
    if (t.matches(".price-edit")) {
      quoteState.prices[t.getAttribute("data-price-id")] = Number(t.value || 0);
      window.BCEstimate.saveState(quoteState);
      renderEstimate();
    }
  });

  bindPhotoRoot(el("photo-cards"));
  bindPhotoRoot(el("exec-photo-cards"));
  bindPhotoRoot(el("comp-photo-cards"));
  el("more-overlay").addEventListener("click", (e) => { if (e.target === el("more-overlay")) closeMore(); });

  const initialView = new URLSearchParams(location.search).get("view") === "estimate" ? "estimate" : "field";
  switchView(initialView);
  initEmptyUi();
  initAiAuthUi();

  window.createCaseSnapshot = createCaseSnapshot;
  window.applyCaseSnapshot = applyCaseSnapshot;
  window.BCFDApp = {
    PHASE_LABELS,
    ALL_PHOTO_DEFS,
    createCaseSnapshot,
    createEmptySnapshot,
    applyCaseSnapshot,
    clearCurrentCaseForm,
    revokeAllPhotos,
    getPendingPhotoOps,
    exportAllPhotoPuts,
    markAllPhotosDeleted,
    clearPendingPhotoOps,
    hasPendingPhotoOps,
    initEmptyUi,
    setDirtyHandler(fn) { dirtyHandler = fn; },
    setClearHandler(fn) { clearHandler = fn; },
    _test: { getSite: () => site, setSite, goToEstimateFromField, buildFieldLines: (s) => window.BCEstimate.buildFieldLines(s) },
  };
})();
