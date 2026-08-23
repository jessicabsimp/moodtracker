const journalPrompts = [
  "What is one small win from today that I want to celebrate?",
  "What is something that brought you unexpected joy recently?",
  "What is a challenge you are facing, and what is one small step forward?",
  "List three things you feel grateful for in this exact moment.",
  "How did you practice self-care or prioritize rest today?",
  "What is a thought or feeling you need to give yourself permission to release?",
  "What is something kind someone said or did for you recently?",
  "Describe a moment today when you felt fully present.",
  "What is a personal boundary you set or maintained recently?",
  "What is a goal for this month, and why does it matter to you?",
  "Write about a song, place, or smell that brought back a good memory.",
  "What is one thing you can do tomorrow to make your day easier?",
  "How are you feeling physically right now, and what does your body need?",
  "What is a quality or skill you appreciate about yourself?",
  "What was the most peaceful part of your day?",
  "Describe a mistake you made recently and what it taught you.",
  "Who is someone you miss, and what would you tell them right now?",
  "What is something new or interesting you learned this week?",
  "What does your ideal restful weekend look like?",
  "How do you handle stress when it first shows up?",
  "What is a favorite memory from your childhood that makes you smile?",
  "What is one area of your life where you feel ready for change?",
  "Write down three positive affirmations that resonate with you today.",
  "What is a book, movie, or conversation that changed your perspective?",
  "How do you show love to the people closest to you?",
  "What is a habit you want to build, and why?",
  "If you could give your past self one piece of advice, what would it be?",
  "What is something you are looking forward to in the near future?",
  "Describe your current morning routine and how it makes you feel.",
  "What is a belief you used to hold that you no longer believe?",
  "How do you bounce back when feeling overwhelmed?",
  "What is a hobby or activity that makes you lose track of time?",
  "Write about a time you surprised yourself with your own strength.",
  "What environment helps you feel the most creative or productive?",
  "How do you react when things don't go according to plan?",
  "What is a quote or lyric that inspires you right now?",
  "What is one thing in your living space that brings you comfort?",
  "How have your priorities shifted over the past year?",
  "What is a compliment you received that meant a lot to you?",
  "If you had a completely free day with no obligations, what would you do?",
  "What does self-compassion mean to you, and how can you practice it?",
  "What is a tough emotion you experienced recently, and how did you process it?",
  "What is something you take for granted that you are actually thankful for?",
  "How do you set time aside to recharge your mental energy?",
  "What is a promise you want to make to yourself moving forward?",
  "Write about a mentor or friend who positively impacted your life.",
  "What is a fear you have overcome, and how did you do it?",
  "How do you define success at this stage of your life?",
  "What is something you want to say 'no' to more often?",
  "What is a topic or activity you want to explore more deeply?"
];

const shufflePromptBtn = document.getElementById('shufflePromptBtn');
const dashboardPromptText = document.getElementById('dashboardPromptText');

if (shufflePromptBtn && dashboardPromptText) {
  shufflePromptBtn.addEventListener('click', () => {
    const currentText = dashboardPromptText.textContent;
    const availablePrompts = journalPrompts.filter(p => p !== currentText);
    const randomPrompt = availablePrompts[Math.floor(Math.random() * availablePrompts.length)];
    dashboardPromptText.textContent = randomPrompt;
  });
}