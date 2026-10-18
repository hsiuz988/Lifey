// 人生大事：點一下就帶入文字、標籤、☆，需要時再問「和誰」
// ask：'people' 提示選人物、'pet' 新增寵物、'child' 新增孩子、'petGone' 選哪一隻寵物離開
// sad：不放慶祝動畫、不預設 ☆，用溫和的提示
// big：重要的大事，會出現在人生地圖那一格

export const EVENT_CATS = [
  ['school', '學業'], ['work', '工作'], ['love', '感情'], ['family', '家庭'], ['home', '生活'],
  ['travel', '旅程'], ['health', '健康'], ['firsts', '人生第一次'], ['farewell', '告別'],
];

export const LIFE_EVENTS = [
  // 學業
  { id: 'school-elementary', cat: 'school', icon: '🎒', label: '上小學', text: '上小學了', tags: ['學習', '里程碑'], big: true },
  { id: 'school-junior', cat: 'school', icon: '🏫', label: '上國中', text: '上國中了', tags: ['學習', '里程碑'] },
  { id: 'school-senior', cat: 'school', icon: '📚', label: '上高中', text: '上高中了', tags: ['學習', '里程碑'] },
  { id: 'school-college', cat: 'school', icon: '🎓', label: '上大學', text: '上大學了', tags: ['學習', '里程碑'], big: true },
  { id: 'school-grad', cat: 'school', icon: '🔬', label: '讀研究所', text: '開始讀研究所', tags: ['學習', '里程碑'] },
  { id: 'graduate', cat: 'school', icon: '🎓', label: '畢業', text: '畢業了！', tags: ['學習', '里程碑'], big: true },
  { id: 'study-abroad', cat: 'school', icon: '🌍', label: '出國留學', text: '出國留學', tags: ['學習', '旅行', '里程碑'], big: true },
  { id: 'exam-pass', cat: 'school', icon: '📝', label: '考上了', text: '考上了！', tags: ['學習', '里程碑'] },
  { id: 'certificate', cat: 'school', icon: '📜', label: '考到證照', text: '考到證照', tags: ['學習', '里程碑'] },
  { id: 'award', cat: 'school', icon: '🏆', label: '得獎', text: '得獎了', tags: ['學習', '里程碑'] },

  // 工作
  { id: 'first-job', cat: 'work', icon: '💼', label: '第一份工作', text: '第一份工作', tags: ['工作', '里程碑'], big: true },
  { id: 'new-job', cat: 'work', icon: '🔄', label: '換工作', text: '換了新工作', tags: ['工作', '里程碑'] },
  { id: 'promotion', cat: 'work', icon: '📈', label: '升職', text: '升職了', tags: ['工作', '里程碑'] },
  { id: 'startup', cat: 'work', icon: '🚀', label: '創業', text: '開始創業', tags: ['工作', '里程碑'], big: true },
  { id: 'side-project', cat: 'work', icon: '💡', label: '開始副業', text: '開始了自己的副業', tags: ['工作', '興趣'] },
  { id: 'big-project', cat: 'work', icon: '🏁', label: '完成大專案', text: '完成了一個重要的專案', tags: ['工作'] },
  { id: 'career-break', cat: 'work', icon: '🌴', label: '離職休息', text: '離職，給自己一段休息', tags: ['工作'] },
  { id: 'retire', cat: 'work', icon: '🏖️', label: '退休', text: '退休了', tags: ['工作', '里程碑'], big: true },

  // 感情
  { id: 'crush', cat: 'love', icon: '💓', label: '心動', text: '遇見讓我心動的人', tags: ['愛情'], ask: 'people' },
  { id: 'dating', cat: 'love', icon: '💕', label: '開始交往', text: '開始交往了', tags: ['愛情', '里程碑'], ask: 'people', big: true },
  { id: 'anniversary', cat: 'love', icon: '🎉', label: '紀念日', text: '交往紀念日', tags: ['愛情'], ask: 'people' },
  { id: 'propose', cat: 'love', icon: '💍', label: '求婚', text: '求婚了', tags: ['愛情', '里程碑'], ask: 'people', big: true },
  { id: 'wedding', cat: 'love', icon: '💒', label: '結婚', text: '結婚了', tags: ['愛情', '家人', '里程碑'], ask: 'people', big: true },
  { id: 'breakup', cat: 'love', icon: '💔', label: '分手', text: '分手了', tags: ['愛情'], ask: 'people', sad: true },
  { id: 'divorce', cat: 'love', icon: '📄', label: '離婚', text: '離婚了', tags: ['愛情', '家人'], ask: 'people', sad: true, big: true },

  // 家庭
  { id: 'pregnant', cat: 'family', icon: '🤰', label: '懷孕', text: '知道有寶寶了', tags: ['家人', '里程碑'] },
  { id: 'baby', cat: 'family', icon: '👶', label: '寶寶出生', text: '寶寶出生了', tags: ['家人', '里程碑'], ask: 'child', big: true },
  { id: 'sibling', cat: 'family', icon: '🧒', label: '多了弟妹', text: '多了一個弟弟／妹妹', tags: ['家人', '里程碑'], ask: 'people', big: true },
  { id: 'pet', cat: 'family', icon: '🐾', label: '養寵物', text: '家裡多了新成員', tags: ['家人', '里程碑'], ask: 'pet', big: true },
  { id: 'family-trip', cat: 'family', icon: '👨‍👩‍👧', label: '家族旅行', text: '和家人一起旅行', tags: ['家人', '旅行'], ask: 'people' },
  { id: 'reunion', cat: 'family', icon: '🥘', label: '家族團聚', text: '全家團聚', tags: ['家人'], ask: 'people' },

  // 生活
  { id: 'move', cat: 'home', icon: '🏠', label: '搬家', text: '搬家了', tags: ['里程碑'], big: true },
  { id: 'live-alone', cat: 'home', icon: '🛏️', label: '第一次自己住', text: '第一次自己住', tags: ['里程碑'], big: true },
  { id: 'buy-house', cat: 'home', icon: '🔑', label: '買房', text: '買了自己的房子', tags: ['里程碑'], big: true },
  { id: 'buy-car', cat: 'home', icon: '🚗', label: '買車', text: '買了車', tags: ['里程碑'] },
  { id: 'renovate', cat: 'home', icon: '🛠️', label: '裝潢新家', text: '裝潢新家', tags: [] },
  { id: 'new-hobby', cat: 'home', icon: '🎨', label: '新嗜好', text: '開始了新的嗜好', tags: ['興趣'] },

  // 旅程
  { id: 'first-abroad', cat: 'travel', icon: '✈️', label: '第一次出國', text: '第一次出國', tags: ['旅行', '里程碑'], big: true },
  { id: 'solo-trip', cat: 'travel', icon: '🎒', label: '一個人旅行', text: '第一次一個人旅行', tags: ['旅行', '里程碑'] },
  { id: 'long-trip', cat: 'travel', icon: '🧳', label: '長途旅行', text: '一趟很長的旅行', tags: ['旅行'] },
  { id: 'emigrate', cat: 'travel', icon: '🌏', label: '移居國外', text: '搬到國外生活', tags: ['旅行', '里程碑'], big: true },
  { id: 'working-holiday', cat: 'travel', icon: '🍎', label: '打工度假', text: '去打工度假', tags: ['旅行', '工作'], big: true },

  // 健康
  { id: 'hospital', cat: 'health', icon: '🏥', label: '住院／開刀', text: '住院了', tags: ['健康'], sad: true },
  { id: 'recover', cat: 'health', icon: '💪', label: '康復', text: '康復了', tags: ['健康', '里程碑'] },
  { id: 'marathon', cat: 'health', icon: '🏃', label: '完成馬拉松', text: '完成了馬拉松', tags: ['運動', '里程碑'] },
  { id: 'new-habit', cat: 'health', icon: '🌱', label: '養成好習慣', text: '開始一個新習慣', tags: ['健康'] },
  { id: 'quit-smoking', cat: 'health', icon: '🚭', label: '戒菸成功', text: '戒菸成功', tags: ['健康', '里程碑'] },

  // 人生第一次
  { id: 'adult', cat: 'firsts', icon: '🎂', label: '滿 18 歲', text: '滿 18 歲，成年了', tags: ['里程碑'] },
  { id: 'vote', cat: 'firsts', icon: '🗳️', label: '第一次投票', text: '第一次投票', tags: ['里程碑'] },
  { id: 'driver', cat: 'firsts', icon: '🪪', label: '考到駕照', text: '考到駕照', tags: ['里程碑'] },
  { id: 'first-salary', cat: 'firsts', icon: '💰', label: '第一份薪水', text: '領到第一份薪水', tags: ['工作', '里程碑'] },
  { id: 'first-invest', cat: 'firsts', icon: '📊', label: '第一次投資', text: '第一次投資', tags: [] },
  { id: 'first-concert', cat: 'firsts', icon: '🎤', label: '第一場演唱會', text: '第一次去演唱會', tags: ['興趣'] },
  { id: 'first-stage', cat: 'firsts', icon: '🎭', label: '第一次上台', text: '第一次上台表演', tags: ['興趣', '里程碑'] },
  { id: 'volunteer', cat: 'firsts', icon: '🤝', label: '當志工', text: '第一次當志工', tags: [] },

  // 告別
  { id: 'farewell', cat: 'farewell', icon: '🕊️', label: '告別', text: '送別了重要的人', tags: ['家人'], ask: 'people', sad: true, big: true },
  { id: 'pet-farewell', cat: 'farewell', icon: '🌈', label: '寵物去了彩虹橋', text: '去了彩虹橋', tags: ['家人'], ask: 'petGone', sad: true, big: true },
  { id: 'friend-away', cat: 'farewell', icon: '👋', label: '好友遠行', text: '好朋友搬去很遠的地方', tags: ['朋友'], ask: 'people', sad: true },
];

const byId = new Map(LIFE_EVENTS.map((e) => [e.id, e]));
export const eventById = (id) => (id ? byId.get(id) || null : null);

// 人物的關係
export const RELATIONS = ['伴侶', '爸爸', '媽媽', '兄弟姊妹', '子女', '祖父母', '親戚', '朋友', '同學', '同事', '其他'];
