export interface HeartEventChoice {
  text: string;
  delta: number;
  reply: string;
}

export interface HeartEvent {
  id: string;
  npcId: string;
  hearts: number;
  title: string;
  lines: string[];
  choices: HeartEventChoice[];
}

export const HEART_EVENTS: HeartEvent[] = [
  // 苏禾
  {
    id: 'su_he_2', npcId: 'su_he', hearts: 2, title: '柜台后的花',
    lines: ['苏禾正趴在柜台上，小心翼翼地给一盆快枯萎的花换土。', '"它是我从森林里捡回来的，可是怎么都养不活……"'],
    choices: [
      { text: '"多晒晒太阳，少浇点水试试。"', delta: 60, reply: '"真的吗？我一直以为要天天浇水！谢谢你，我试试看。"' },
      { text: '"枯了就扔了吧。"', delta: -30, reply: '"……你说得对，只是一盆花而已。"她的声音低了下去。' },
    ],
  },
  {
    id: 'su_he_4', npcId: 'su_he', hearts: 4, title: '父女争执',
    lines: ['你路过杂货铺，听到里面传来争吵声。', '周伯："开花店？能养活自己吗？"苏禾红着眼跑了出来，差点撞到你。'],
    choices: [
      { text: '陪她在井边坐一会儿', delta: 80, reply: '她沉默了很久，最后小声说："谢谢你什么都没问。"' },
      { text: '"你爸也是为你好。"', delta: 10, reply: '"我知道……可我就是想试试嘛。"' },
      { text: '假装没看见走开', delta: -20, reply: '你走远了，身后传来轻轻的抽泣声。' },
    ],
  },
  {
    id: 'su_he_6', npcId: 'su_he', hearts: 6, title: '森林里的花田',
    lines: ['苏禾神秘兮兮地把你拉进森林深处。', '眼前是一片她偷偷开垦的小花田，五颜六色的花在风里摇。', '"这是我的秘密基地，你是第一个来的人。"'],
    choices: [
      { text: '"这里真美，就像你一样。"', delta: 100, reply: '她的脸一下子红了："你、你别乱说……"却笑得很开心。' },
      { text: '"以后我帮你一起照顾它们。"', delta: 80, reply: '"一言为定！拉钩！"' },
    ],
  },
  {
    id: 'su_he_8', npcId: 'su_he', hearts: 8, title: '星空下',
    lines: ['夜里，苏禾约你到广场看流星。', '"我爸终于同意了，说等我攒够钱就让我开花店。"', '她转头看着你："其实……我最想第一个告诉的人，是你。"'],
    choices: [
      { text: '轻轻握住她的手', delta: 120, reply: '她没有抽开手，只是把头靠在了你的肩上。' },
      { text: '"恭喜你！我们是最好的朋友。"', delta: 20, reply: '"……嗯，最好的朋友。"她笑了笑，眼神却有些失落。' },
    ],
  },
  // 陆远
  {
    id: 'lu_yuan_2', npcId: 'lu_yuan', hearts: 2, title: '断线',
    lines: ['陆远的鱼线突然断了，一条大鱼甩着尾巴逃走了。', '他盯着海面，一句话也不说。'],
    choices: [
      { text: '"下次一定能钓到。"', delta: 50, reply: '"……嗯。"他嘴角动了一下，像是笑了。' },
      { text: '"你技术不行啊。"', delta: -30, reply: '他冷冷地看了你一眼，转过身去。' },
    ],
  },
  {
    id: 'lu_yuan_4', npcId: 'lu_yuan', hearts: 4, title: '爷爷的船',
    lines: ['码头边停着一艘破旧的小船。', '"这是我爷爷的船。他年纪大了，出不了海了。"', '"我想把它修好，带他再出一次海。"'],
    choices: [
      { text: '"我帮你一起修。"', delta: 80, reply: '他愣了一下，然后递给你一把锤子："……谢了。"' },
      { text: '"这船还能修好吗？"', delta: 0, reply: '"能。"他回答得很坚定。' },
    ],
  },
  {
    id: 'lu_yuan_6', npcId: 'lu_yuan', hearts: 6, title: '出海',
    lines: ['小船终于修好了。陆远、爷爷和你一起驶向海上。', '老渔夫看着落日，笑得像个孩子。', '陆远低声说："谢谢你。没有你，我坚持不下来。"'],
    choices: [
      { text: '"是你自己很努力。"', delta: 90, reply: '他看着你，第一次露出了毫无保留的笑容。' },
      { text: '默默陪他看日落', delta: 70, reply: '海风吹过，你们谁都没有说话，却觉得很安心。' },
    ],
  },
  {
    id: 'lu_yuan_8', npcId: 'lu_yuan', hearts: 8, title: '灯塔',
    lines: ['陆远带你爬上海边废弃的灯塔。', '"小时候我总觉得一个人也挺好。"', '"现在……我不想再一个人了。"'],
    choices: [
      { text: '"那以后，我陪着你。"', delta: 120, reply: '他别过头去，耳朵却红透了："……说好了。"' },
      { text: '"你还有你爷爷啊。"', delta: 10, reply: '"……是啊。"他笑了笑，看向远方的海。' },
    ],
  },
  // 阿青
  {
    id: 'a_qing_2', npcId: 'a_qing', hearts: 2, title: '打铁比赛',
    lines: ['阿青把一块烧红的铁拍在砧上："来！比比谁打得快！"'],
    choices: [
      { text: '撸起袖子就上', delta: 60, reply: '你累得满头大汗，阿青大笑："不错嘛！你是第一个敢跟我比的！"' },
      { text: '"我还是看着吧。"', delta: 0, reply: '"切，没劲。"她撇撇嘴，自己叮叮当当打了起来。' },
    ],
  },
  {
    id: 'a_qing_4', npcId: 'a_qing', hearts: 4, title: '师傅的话',
    lines: ['阿青蹲在铁匠铺后门，手里攥着一把歪歪扭扭的剑。', '"师傅说我性子太急，永远打不出好剑。"'],
    choices: [
      { text: '"急性子也能打出快剑。"', delta: 80, reply: '她噗地笑出声："快剑？哈哈，好，我就打一把天下最快的剑！"' },
      { text: '"那就慢慢来呀。"', delta: 40, reply: '"慢慢来……好吧，我试试。"' },
    ],
  },
  {
    id: 'a_qing_6', npcId: 'a_qing', hearts: 6, title: '矿洞救援',
    lines: ['你在矿洞里遇到了阿青，她被一群蝙蝠围住了。', '你冲上去帮她赶跑了怪物。', '"哼，我、我本来也能搞定的！……不过，谢谢你。"'],
    choices: [
      { text: '"我知道，你最厉害了。"', delta: 90, reply: '"那、那当然！"她嘴硬，脸却红到了脖子根。' },
      { text: '"下次别一个人来了。"', delta: 70, reply: '"那……下次你陪我来？"' },
    ],
  },
  {
    id: 'a_qing_8', npcId: 'a_qing', hearts: 8, title: '那把剑',
    lines: ['阿青把一个长布包塞到你手里。', '里面是一把打磨得发亮的剑，剑柄上刻着你的名字。', '"我第一把满意的剑……想给最重要的人。"'],
    choices: [
      { text: '"我会一直带着它。"', delta: 120, reply: '她用力抱了你一下，然后飞快地跑开了："不许笑我！"' },
      { text: '"太贵重了，我不能收。"', delta: -10, reply: '"……你不要就算了！"她抢回布包，转身就走。' },
    ],
  },
  // 白芷
  {
    id: 'bai_zhi_2', npcId: 'bai_zhi', hearts: 2, title: '采药',
    lines: ['白芷在森林里采药，脚下一滑差点摔倒。你扶住了她。', '"谢谢……我总是这么不小心。"'],
    choices: [
      { text: '帮她把药篮装满', delta: 60, reply: '"你认识这么多草药？真厉害。"她眼睛亮亮的。' },
      { text: '"小心点。"', delta: 20, reply: '她点点头，继续低头找药。' },
    ],
  },
  {
    id: 'bai_zhi_4', npcId: 'bai_zhi', hearts: 4, title: '深夜的诊所',
    lines: ['深夜，诊所还亮着灯。白芷趴在桌上睡着了，手边是一摞医书。', '你轻手轻脚地走进去。'],
    choices: [
      { text: '给她披上外套', delta: 80, reply: '第二天她找到你，把叠好的外套还给你："……是你吧？谢谢。"' },
      { text: '叫醒她让她回家睡', delta: 30, reply: '"啊，已经这么晚了？谢谢你提醒我。"' },
    ],
  },
  {
    id: 'bai_zhi_6', npcId: 'bai_zhi', hearts: 6, title: '母亲的药方',
    lines: ['白芷给你看一本泛黄的笔记。', '"这是我妈妈留下的药方。她是个很好的医生……我一直想成为她那样的人。"'],
    choices: [
      { text: '"你已经是了。"', delta: 100, reply: '她的眼眶红了，轻轻说："谢谢你这么说。"' },
      { text: '"你一定可以的。"', delta: 70, reply: '"嗯，我会努力的。"' },
    ],
  },
  {
    id: 'bai_zhi_8', npcId: 'bai_zhi', hearts: 8, title: '萤火虫',
    lines: ['夏夜的森林，萤火虫在你们身边飞舞。', '白芷伸出手，一只萤火虫停在她指尖。', '"我从来没有这么想留住一个瞬间……因为你在。"'],
    choices: [
      { text: '"以后还有很多这样的夜晚。"', delta: 120, reply: '她笑着靠近你，萤火虫绕着你们飞成一圈。' },
      { text: '"萤火虫真漂亮。"', delta: 10, reply: '"……是啊。"她轻轻放走了那只萤火虫。' },
    ],
  },
  // 周伯
  {
    id: 'zhou_bo_3', npcId: 'zhou_bo', hearts: 3, title: '老照片',
    lines: ['周伯拿出一张老照片，上面是年轻的他和你爷爷站在麦田里。', '"你爷爷教会了我怎么挑好种子。"'],
    choices: [
      { text: '"能多讲讲爷爷的事吗？"', delta: 70, reply: '周伯打开了话匣子，一讲就是一下午。' },
      { text: '"原来你们是老朋友。"', delta: 30, reply: '"是啊，几十年的交情了。"' },
    ],
  },
  {
    id: 'zhou_bo_6', npcId: 'zhou_bo', hearts: 6, title: '父亲的心事',
    lines: ['周伯叹了口气："苏禾想开花店，我嘴上反对，其实是怕她吃苦。"', '"你说，我该怎么办？"'],
    choices: [
      { text: '"支持她吧，你会是她最大的底气。"', delta: 80, reply: '周伯沉默良久，点了点头："你说得对。"' },
      { text: '"你的担心也有道理。"', delta: 20, reply: '"唉，当爹的难啊。"' },
    ],
  },
  // 秦婆婆
  {
    id: 'qin_popo_3', npcId: 'qin_popo', hearts: 3, title: '围巾',
    lines: ['秦婆婆递给你一条织了一半的围巾。', '"眼睛不中用了，你帮我穿下针好不好？"'],
    choices: [
      { text: '耐心地帮她穿针', delta: 70, reply: '"好孩子。"她笑眯眯地摸了摸你的头。' },
      { text: '"我不太会……"', delta: 10, reply: '"没关系，老婆子自己慢慢来。"' },
    ],
  },
  {
    id: 'qin_popo_6', npcId: 'qin_popo', hearts: 6, title: '爷爷的约定',
    lines: ['秦婆婆把织好的围巾围在你脖子上。', '"你爷爷走之前托我照看你。现在看来，你不需要我照看啦。"', '"山谷交给你，他一定很放心。"'],
    choices: [
      { text: '紧紧抱住她', delta: 100, reply: '她轻轻拍着你的背："好了好了，都多大的人了。"' },
      { text: '"谢谢婆婆。"', delta: 60, reply: '"谢什么，一家人。"' },
    ],
  },
];

export const EVENT_BY_ID: Record<string, HeartEvent> = Object.fromEntries(HEART_EVENTS.map((e) => [e.id, e]));
