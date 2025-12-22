
import { Book, ThemeType } from './types';

// Visual Style: Blue primary
export const PRIMARY_COLOR = '#3B82F6'; 

export const THEMES = {
    [ThemeType.Light]: { 
        bg: 'bg-white', 
        text: 'text-[#1f2937]', 
        secondary: 'text-gray-500', 
        panel: 'bg-[#f5f5f7]' 
    },
    [ThemeType.Gray]: { 
        bg: 'bg-[#F2F2F7]', 
        text: 'text-[#374151]', 
        secondary: 'text-[#9ca3af]', 
        panel: 'bg-[#E5E5EA]' 
    },
    [ThemeType.Dark]: { 
        bg: 'bg-[#0f172a]', 
        text: 'text-[#f3f4f6]', 
        secondary: 'text-[#94a3b8]', 
        panel: 'bg-[#1e293b]' 
    },
};

// Mock Data
export const MOCK_BOOKS: Book[] = [
    {
        id: '1',
        title: 'The Design of Everyday Things',
        author: 'Don Norman',
        // Liquid gradient cover
        coverColor: 'bg-gradient-to-br from-blue-400 to-cyan-300 backdrop-blur-md',
        progress: 12,
        totalParams: 240,
        content: [
            "Two of the most important characteristics of good design are discoverability and understanding.",
            "Discoverability: Is it possible to even figure out what actions are possible and where and how to perform them? Understanding: What does it all mean? How is the product supposed to be used? What do all the different controls and settings mean?",
            "The complex world of modern technology. We are surrounded by technology. It helps us, it governs our lives. But it also frustrates us.",
            "Human-centered design (HCD) is a design philosophy. It means starting with a good understanding of people and the needs that the design is intended to meet.",
            "This philosophy applies to everything, not just computers or electronics. It applies to doors, light switches, and faucets.",
            "When I interact with a device, I need to know what to do. I need to know what is happening. Feedback is critical.",
            "Affordances are the possible interactions between people and the environment. Some affordances are perceivable, others are not.",
            "Signifiers signal things, in particular what actions are possible and how they should be done. Signifiers must be perceivable, else they fail to function.",
            "Mapping is a technical term, borrowed from mathematics, meaning the relationship between the elements of two sets of things.",
            "Constraints are powerful clues, limiting the set of possible actions. The thoughtful use of constraints in design lets people readily determine the proper course of action, even in a novel situation."
        ]
    },
    {
        id: '2',
        title: 'Sapiens: A Brief History',
        author: 'Yuval Noah Harari',
        // Liquid gradient cover
        coverColor: 'bg-gradient-to-br from-amber-400 to-orange-300 backdrop-blur-md',
        progress: 45,
        totalParams: 300,
        content: [
            "About 13.5 billion years ago, matter, energy, time and space came into being in what is known as the Big Bang.",
            "The story of these fundamental features of our universe is called physics.",
            "About 300,000 years after their appearance, matter and energy started to coalesce into complex structures, called atoms, which then combined into molecules.",
            "The story of atoms, molecules and their interactions is called chemistry.",
            "About 3.8 billion years ago, on a planet called Earth, certain molecules combined to form particularly large and intricate structures called organisms.",
            "The story of organisms is called biology.",
            "About 70,000 years ago, organisms belonging to the species Homo sapiens started to form even more elaborate structures called cultures.",
            "The subsequent development of these human cultures is called history.",
            "Three important revolutions shaped the course of history: the Cognitive Revolution kick-started history about 70,000 years ago.",
            "The Agricultural Revolution sped it up about 12,000 years ago. The Scientific Revolution, which got under way only 500 years ago, may well end history and start something completely different."
        ]
    }
];
