import type { RoadmapDraft } from "@/types/syllabus";

/**
 * Built-in syllabus used by the empty-state "Start from a template" path.
 * A compact CBSE Class 11 + 12 roadmap (shipped with the app — no AI or PDF
 * needed) so a brand-new user has an interactive coverage map in one click.
 */
export const CBSE_TEMPLATE: RoadmapDraft = {
  course: "CBSE Class 11 & 12 · Core",
  warnings: [],
  subjects: [
    {
      name: "Mathematics",
      classLevel: "Class 11 & 12",
      examTags: ["CBSE", "JEE Main"],
      chapters: [
        {
          name: "Sets, Relations & Functions",
          description: "Foundations of every math topic",
          concepts: [
            { name: "Sets & Representation", prerequisites: [], difficulty: "Easy", tags: ["CBSE"] },
            { name: "Relations", prerequisites: ["Sets & Representation"], difficulty: "Easy", tags: ["CBSE"] },
            { name: "Types of Functions", prerequisites: ["Relations"], difficulty: "Medium", tags: ["CBSE"] },
          ],
        },
        {
          name: "Limits, Continuity & Derivatives",
          description: "The core of calculus",
          concepts: [
            { name: "Limits", prerequisites: ["Sets & Representation"], difficulty: "Medium", tags: ["CBSE"] },
            { name: "Continuity", prerequisites: ["Limits"], difficulty: "Medium", tags: ["CBSE"] },
            {
              name: "Derivatives & Applications",
              prerequisites: ["Continuity"],
              difficulty: "Hard",
              tags: ["CBSE", "JEE Main"],
            },
          ],
        },
      ],
    },
    {
      name: "Physics",
      classLevel: "Class 11 & 12",
      examTags: ["CBSE", "JEE Main", "NEET"],
      chapters: [
        {
          name: "Physical World & Units",
          description: "Measurement is the language of physics",
          concepts: [
            { name: "SI Units & Dimensions", prerequisites: [], difficulty: "Easy", tags: ["CBSE"] },
            { name: "Error Analysis", prerequisites: ["SI Units & Dimensions"], difficulty: "Medium", tags: ["CBSE"] },
          ],
        },
        {
          name: "Laws of Motion",
          description: "Newton's framework",
          concepts: [
            { name: "Newton's Laws", prerequisites: ["SI Units & Dimensions"], difficulty: "Medium", tags: ["CBSE", "NEET"] },
            { name: "Friction", prerequisites: ["Newton's Laws"], difficulty: "Medium", tags: ["CBSE", "JEE Main"] },
          ],
        },
      ],
    },
    {
      name: "Chemistry",
      classLevel: "Class 11 & 12",
      examTags: ["CBSE", "NEET"],
      chapters: [
        {
          name: "Some Basic Concepts of Chemistry",
          description: "Mole concept and stoichiometry",
          concepts: [
            { name: "Mole Concept", prerequisites: [], difficulty: "Easy", tags: ["CBSE", "NEET"] },
            { name: "Stoichiometry", prerequisites: ["Mole Concept"], difficulty: "Medium", tags: ["CBSE", "NEET"] },
          ],
        },
        {
          name: "Structure of Atom",
          description: "Inside the atom",
          concepts: [
            { name: "Atomic Models", prerequisites: [], difficulty: "Easy", tags: ["CBSE"] },
            { name: "Quantum Numbers", prerequisites: ["Atomic Models"], difficulty: "Hard", tags: ["CBSE", "NEET"] },
          ],
        },
      ],
    },
  ],
};