import type { DataPlot, DataTable, DomainId, Difficulty } from '../../types'

interface Blueprint {
  id: string
  skillId: string
  domain: DomainId
  difficulty: Difficulty
  stimulus?: string
  secondaryStimulus?: string
  table?: DataTable
  plot?: DataPlot
  prompt: string
  choices: string[]
  answer: number
  explanation: string
  traps: string[]
}

export const newItems: Blueprint[] = [
  {
    id: "tsp-09",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 1,
    stimulus: "The Ridgeline Seed Library lends vegetable seeds the way an ordinary library lends books: borrowers take what they need in spring and return a portion of what they harvest in autumn. Its founders describe the arrangement as a way to keep locally adapted varieties in circulation. A member who saves seed from a tomato that thrived through an unusually dry July returns seed already shaped by that summer, and the following spring several households plant it. Repeated across a decade, this ordinary exchange has quietly assembled a collection suited to the valley, with its short season and its thin, fast-draining soil.",
    prompt: "Which choice best describes the function of the third sentence in the text as a whole?",
    choices: [
      "It raises an objection to the way the founders describe the seed library.",
      "It states the seed library's overall aim as its founders understand it.",
      "It offers a concrete case showing how the general aim described just before is carried out.",
      "It reports that one variety of tomato survived an unusually dry July."
    ],
    answer: 2,
    explanation: "The founders' stated aim is abstract, and the third sentence supplies the single member and single tomato that make the aim visible as a sequence of actions. It cannot be stating the aim itself, because the sentence before it has already done that.",
    traps: [
      "Nothing in the sentence pushes back on the founders; it shows their description working",
      "The second sentence states the aim, so this describes a different part of the text",
      "Supported",
      "This restates a detail the sentence mentions rather than naming what the sentence does"
    ]
  },
  {
    id: "tsp-10",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 1,
    stimulus: "Walk through a damp Appalachian forest on a moonless night in late summer and you may see a faint green glow rising from rotting logs on the forest floor. The light comes from fungi rather than from insects, and it is produced by a chemical reaction in the fungal tissue itself. Biologists have long known what the glow is made of; what it is for has been much harder to settle. One proposal holds that the light attracts insects, which then carry fungal spores away on their bodies. Another holds that the glow is a byproduct of ordinary fungal metabolism, useful to nothing at all.",
    prompt: "Which choice best describes the overall structure of the text?",
    choices: [
      "It describes an observable phenomenon, notes an unresolved question about it, and presents two competing answers.",
      "It presents a widely accepted explanation and then supplies evidence that refutes it.",
      "It reports that fungi growing on rotting logs give off a faint green light at night.",
      "It follows one biologist's investigation from an early mistake to an eventual correction."
    ],
    answer: 0,
    explanation: "The text moves from the glow itself, to the admission that its function is unsettled, to two proposals offered side by side without a verdict. No explanation is refuted, since neither proposal is tested against the other.",
    traps: [
      "Supported",
      "Neither proposal is accepted or refuted; both are left standing",
      "This restates the passage's opening content instead of naming its structure",
      "No individual researcher, error, or correction appears in the text"
    ]
  },
  {
    id: "tsp-11",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 1,
    stimulus: "The following text is adapted from a 2019 short story. Ines has returned to the apartment where her grandmother once lived.\n\nThe furniture had not moved. The green chair still faced the window at the same slight angle, as though someone had turned it to catch a conversation happening in the street below. Ines set her bag down and did not sit. On the sideboard the same three photographs stood in the same order, and the dust on them lay even and undisturbed, the dust of a room nobody enters rather than a room nobody cleans. She understood then that her cousin had been paying the rent for years without ever once coming inside.",
    prompt: "Which choice best states the function of the final sentence in the text as a whole?",
    choices: [
      "It explains why Ines had decided to return to the apartment.",
      "It describes the angle at which the green chair faces the window.",
      "It casts doubt on whether the room has really been left untouched.",
      "It turns the details Ines has been noticing into a conclusion about another person's conduct."
    ],
    answer: 3,
    explanation: "The unmoved chair, the ordered photographs, and the even dust are observations, and the last sentence converts them into an inference about what the cousin has and has not done. It cannot be doubting that the room is untouched, since the untouched condition is exactly what the inference rests on.",
    traps: [
      "Her reason for returning is never given anywhere in the text",
      "This describes an earlier sentence rather than the one asked about",
      "The undisturbed dust supports the conclusion instead of being questioned by it",
      "Supported"
    ]
  },
  {
    id: "tsp-12",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 1,
    stimulus: "Roman milestones were stone columns set beside imperial roads at regular intervals across the provinces. Each carried the distance to the nearest major town, but most also carried the name and the accumulated titles of the emperor under whom the road had been built or repaired. A traveler who stopped at the stone for an entirely practical reason could not help reading the name as well. Historians of the provinces therefore treat a milestone as two documents at once: a record of where the roads actually ran, and a record of which rulers wished to be seen keeping them in good order.",
    prompt: "What is the main purpose of the text?",
    choices: [
      "To show that milestones misled travelers about the real distances between towns",
      "To explain why an object with a practical roadside use also served a political one",
      "To report that every milestone listed the distance to the nearest major town",
      "To trace changes over time in how emperors were addressed in official inscriptions"
    ],
    answer: 1,
    explanation: "The text sets the useful distance figure beside the imperial name and argues that reading one meant reading the other, which is why historians read the stones twice over. Nothing suggests the distances were inaccurate; their reliability is what brings the traveler to the stone.",
    traps: [
      "The text presents the distances as genuinely useful, not as deceptive",
      "Supported",
      "This restates one detail instead of naming the text's overall purpose",
      "The titles are mentioned once and their history is never followed"
    ]
  },
  {
    id: "tsp-13",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 1,
    stimulus: "A sourdough starter is a jar of flour and water kept alive by regular feeding. Bakers often speak of it as though it were a single organism with a temperament, but it is a community: wild yeasts that release carbon dioxide, and lactic acid bacteria that produce the acids responsible for the tang. The two groups depend on one another. The bacteria flourish in the acidic conditions they themselves create, conditions that suppress competing microbes, and the yeasts tolerate that acidity better than most rivals do. What a baker calls a starter's temperament is largely the balance struck between these two populations on a given week.",
    prompt: "Which choice best describes the function of the second sentence in the text as a whole?",
    choices: [
      "It corrects a familiar way of describing a starter and introduces the distinction the rest of the text develops.",
      "It endorses the bakers' view that a starter behaves like one organism.",
      "It explains why lactic acid bacteria tolerate acidic conditions so well.",
      "It notes that the yeasts in a starter give off carbon dioxide."
    ],
    answer: 0,
    explanation: "The sentence sets the bakers' single-organism talk against the two-population reality, and every sentence afterward works out the relationship between those two populations. It cannot endorse the single-organism view, since it is built around a contrast that replaces it.",
    traps: [
      "Supported",
      "The sentence contradicts that view rather than accepting it",
      "That explanation appears later, in the fourth sentence",
      "This repeats a detail the sentence contains instead of naming its function"
    ]
  },
  {
    id: "tsp-14",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 1,
    stimulus: "When a heat wave settles over a city, its public libraries fill with people who have not come to borrow anything at all. Libraries are air-conditioned, free, and open to anyone without a ticket or a purchase, which makes them the default refuge for residents whose apartments have no cooling. Officials in several states have begun formally designating branches as cooling centers during declared emergencies. The designation does not change what a library is; it recognizes a role the building was already playing. Librarians, though, point out that the recognition has generally arrived without additional staff, drinking water, or training in medical emergencies.",
    prompt: "Which choice best states the function of the final sentence in the text as a whole?",
    choices: [
      "It explains why residents without air conditioning come to libraries during heat waves.",
      "It argues that libraries should stop serving as cooling centers altogether.",
      "It adds a qualification that limits the significance of the official recognition just described.",
      "It reports that librarians have not received additional staffing or supplies."
    ],
    answer: 2,
    explanation: "The word though sets the librarians' complaint against the designation described just before, cutting the recognition down to a label unaccompanied by resources. It stops well short of urging libraries to abandon the role, which the text treats as one they were already filling.",
    traps: [
      "That explanation is given in the second sentence, not the last",
      "The librarians ask for support for the role, not for its end",
      "Supported",
      "This restates the sentence's content rather than naming what it does"
    ]
  },
  {
    id: "tsp-15",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 1,
    stimulus: "A Japanese woodblock print is usually credited to a single artist, yet the image on the paper is the work of at least four people. The artist supplies a brush drawing. A carver cuts that drawing into cherry wood, destroying the original in the process, and a separate block has to be cut for every color in the design. A printer inks the blocks, aligns each sheet by touch against small notches, and pulls every impression by hand. A publisher chooses the subject, pays the others, and carries the commercial risk. The signature on the finished sheet names only the first of these five contributors.",
    prompt: "What is the main purpose of the text?",
    choices: [
      "To argue that carvers produced finer work than the artists who drew the designs",
      "To show that a form of authorship recorded as individual was in practice collaborative",
      "To describe the tools and varieties of wood used in traditional printmaking",
      "To defend the practice of crediting each print to its signing artist alone"
    ],
    answer: 1,
    explanation: "The text opens on the single credit, walks through four separate hands, and closes by noting that the signature covers only one of them. It cannot be defending that signature convention, since the whole middle of the passage exists to show how much the convention leaves out.",
    traps: [
      "No comparison of quality between contributors is made anywhere",
      "Supported",
      "The materials appear as incidental detail, not as the point",
      "The text quietly criticizes that practice rather than defending it"
    ]
  },
  {
    id: "tsp-16",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 1,
    stimulus: "A desert ant that leaves its nest to forage may wander several hundred meters along a crooked path, yet the moment it finds food it turns and runs almost straight home. It is not following a scent trail; the sand is far too hot for any trail to survive. Instead the ant appears to keep a running tally of every direction it has faced and every step it has taken, then to combine those into a single vector pointing back to the entrance. Researchers who fitted foraging ants with tiny stilts, lengthening each stride, found that the ants overshot the nest by a strikingly predictable margin.",
    prompt: "Which choice best states the function of the final sentence in the text as a whole?",
    choices: [
      "It introduces the puzzle that the rest of the text sets out to explain.",
      "It shows that the ants rely on scent trails after all.",
      "It reports that researchers attached stilts to some of the ants.",
      "It presents an experimental result that supports the account of navigation offered just before."
    ],
    answer: 3,
    explanation: "If an ant counts steps, lengthening its stride should make it run too far, and that is exactly what the stilted ants did. The result therefore backs the step-counting account rather than reviving the scent trail the second sentence has already ruled out.",
    traps: [
      "The puzzle is set up in the first sentence, not the last",
      "The heat of the sand rules scent trails out earlier in the text",
      "This restates a detail of the experiment instead of naming its role",
      "Supported"
    ]
  },
  {
    id: "tsp-17",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 2,
    stimulus: "A jazz standard is not a fixed object. The written melody and chords of a tune drawn from a 1930s show occupy a single page, and nearly everything an audience recognizes as the performance, the tempo, the harmonic substitutions, the order and the length of the solos, is settled somewhere else entirely. Two recordings of the same standard made in the same decade can share almost nothing but a chord sequence and a title. This is why musicians speak of playing on a tune rather than simply playing it. The page is less a score than a set of coordinates that a band agrees to navigate together.",
    prompt: "Which choice best states the function of the final sentence in the text as a whole?",
    choices: [
      "It restates the text's central claim as a figure of speech that condenses the preceding explanation.",
      "It raises a doubt about whether the musicians in a band really agree in advance.",
      "It explains why two recordings of one standard may share only a chord sequence.",
      "It states that a standard's melody and chords fit onto a single page."
    ],
    answer: 0,
    explanation: "Coordinates rather than a score is a compact image for everything the text has argued: the page fixes very little and the band supplies the rest. It cannot be doubting the band's agreement, since agreeing to navigate together is part of the image itself.",
    traps: [
      "Supported",
      "The sentence presents the band's agreement as given, not as questionable",
      "That work is done by the third sentence rather than the last",
      "This repeats a detail from earlier instead of naming a function"
    ]
  },
  {
    id: "tsp-18",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 2,
    stimulus: "For a long time the enormous shell heaps along certain coastlines were read as refuse, the accumulated leavings of people who ate shellfish and threw the shells aside. The heaps are undeniably full of discarded shells. But excavation has shown that many are layered too regularly for casual dumping, that some contain hearths and burials set deliberately into the mass, and that a few were built up into shaped mounds clearly visible from the water. Refuse does not account for those features. Archaeologists now treat the heaps as places used and returned to, where accumulating shell became, across generations, a way of marking a shoreline as occupied.",
    prompt: "Which choice best describes the overall structure of the text?",
    choices: [
      "It presents a revised interpretation and then restores the original refuse explanation.",
      "It compares two rival excavation techniques and finally endorses neither.",
      "It reports that the shell heaps contain hearths, burials, and shaped mounds.",
      "It presents a long-standing reading, concedes part of it, introduces findings it cannot cover, and offers a revision."
    ],
    answer: 3,
    explanation: "The refuse reading comes first and is granted in part, the layering and burials are then introduced as things refuse cannot explain, and the occupation reading closes the passage. The order is not reversed; the refuse account is the starting point, never the conclusion.",
    traps: [
      "The refuse reading is the text's premise and is superseded, not restored",
      "Only one excavation record is discussed and no techniques are compared",
      "This lists findings the text reports rather than describing its arrangement",
      "Supported"
    ]
  },
  {
    id: "tsp-19",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 2,
    stimulus: "Employers who enroll new workers in a retirement plan automatically, allowing anyone to opt out at any time, see participation rates far above those of employers who ask workers to opt in. The difference is not explained by what workers earn or by how well they understand the plan. It appears instead to reflect the cost of taking action at all: filling out a form, selecting a contribution rate, and choosing among funds are small burdens, but small burdens applied at a moment when nothing bad happens if you postpone are enough to stop a great many people. The default persuades no one. It changes which decision requires effort.",
    prompt: "Which choice best states the function of the final sentence in the text as a whole?",
    choices: [
      "It concedes that automatic enrollment has no measurable effect on participation.",
      "It names precisely the mechanism the text has been building toward, marking it off from persuasion.",
      "It reports that workers must select a contribution rate and choose among funds.",
      "It recommends that employers be required by law to enroll workers automatically."
    ],
    answer: 1,
    explanation: "Paired with the sentence before it, the closing line separates two ways a policy might work and says which one is operating: not argument, but the placement of effort. It cannot be conceding that the policy has no effect, since the opening sentence reports a large one.",
    traps: [
      "The first sentence reports a large participation gap, so no such concession is made",
      "Supported",
      "This restates an earlier detail rather than naming what the sentence does",
      "The text explains the mechanism and never proposes a legal requirement"
    ]
  },
  {
    id: "tsp-20",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 2,
    stimulus: "In her later collections the poet Marguerite Osei almost never allows a sentence to end where a line ends. A clause begins at the right margin of one line and completes itself at the left margin of the next, so that the reader is repeatedly handed a phrase that seems finished and then obliged to revise it. Critics have described the resulting effect as restlessness. Osei herself offers a plainer account: she wants the reader's eye to arrive at the bottom of a page before the reader's understanding does, because a poem read slightly ahead of itself keeps its meaning provisional for a moment longer.",
    prompt: "Which choice best states the function of the final sentence in the text as a whole?",
    choices: [
      "It disputes the claim that Osei's lines rarely end where her sentences end.",
      "It characterizes the way critics have received Osei's later work.",
      "It supplies the poet's own account of a technique the text has described from the outside.",
      "It argues that Osei's earlier collections are more accomplished than her later ones."
    ],
    answer: 2,
    explanation: "The first three sentences describe the line breaks and report an outside verdict on them; the last sentence hands the explanation to Osei and gives her reason for the practice. It cannot dispute the description of her line breaks, since her explanation assumes that the line breaks work as described.",
    traps: [
      "Her account presupposes the pattern rather than denying it",
      "The critics' reception is handled in the third sentence",
      "Supported",
      "The earlier collections are never evaluated or even described"
    ]
  },
  {
    id: "tsp-21",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 2,
    stimulus: "A tardigrade can survive being dried to roughly three percent of its normal water content, a condition in which its metabolism becomes undetectable. What replaces the missing water matters far more than the drying itself. As moisture leaves, the animal floods its cells with sugars and with disordered proteins that set into a glassy solid, holding membranes and enzymes in position so that nothing collapses or unfolds. Add water and the glass dissolves; the animal resumes activity within minutes, sometimes after years. The trick is not that a tardigrade tolerates the absence of water. It is that it never lets its interior become a liquid capable of draining away.",
    prompt: "Which choice best describes the function of the second sentence in the text as a whole?",
    choices: [
      "It supplies evidence that tardigrades cannot in fact survive complete desiccation.",
      "It restates the measurement of water loss given in the first sentence.",
      "It summarizes the conclusion the text reaches in its last two sentences.",
      "It redirects attention from the striking fact just stated to the process the rest of the text explains."
    ],
    answer: 3,
    explanation: "The opening reports the survival; the second sentence says the interesting question lies elsewhere, and the sugars, the glass, and the rehydration follow directly from that redirection. It is not the conclusion in miniature, since it names no mechanism and only points toward one.",
    traps: [
      "The text affirms the survival and explains how it works",
      "The sentence moves past that measurement rather than repeating it",
      "The sentence poses the question the closing sentences answer, and answers nothing itself",
      "Supported"
    ]
  },
  {
    id: "tsp-22",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 2,
    stimulus: "Historians once assumed that the short-lived newspapers published by women's associations in the 1850s could tell us very little, since nearly all of them folded within three years and their circulations were tiny. Recent work has taken the failures themselves as evidence. Surviving subscription ledgers show where copies traveled, and the towns that appear again and again turn out to be the same towns that later hosted the first state conventions. A paper that lasted eighteen months and reached four hundred households was no commercial success, but it was a map of who already knew whom. The brevity that once made these papers seem negligible is what makes their records legible.",
    prompt: "What is the main purpose of the text?",
    choices: [
      "To explain how a feature once treated as a reason to dismiss certain sources became a reason to use them",
      "To argue that the women's newspapers of the 1850s were commercially profitable",
      "To describe the geographic distribution of the earliest state conventions",
      "To report that most of these newspapers folded within three years"
    ],
    answer: 0,
    explanation: "Short runs and tiny circulations begin the text as grounds for dismissal and end it as the very thing that makes the ledgers readable as a network. Profitability is explicitly denied along the way, so no claim of commercial success is available.",
    traps: [
      "Supported",
      "The text calls a paper reaching four hundred households no commercial success",
      "The conventions appear only as a check on the ledger towns",
      "This restates a detail rather than naming the text's purpose"
    ]
  },
  {
    id: "tsp-23",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 2,
    stimulus: "On a July afternoon the air beneath a mature street tree can be several degrees cooler than the air over open sidewalk twenty steps away. Shade accounts for part of that difference; the rest comes from transpiration, as water drawn up through the roots evaporates from the leaves and carries heat away with it. Neither effect is distributed evenly across a city. Canopy cover in most American cities tracks the age and the wealth of neighborhoods closely enough that a map of tree cover doubles as a map of past investment. The physics is identical on every block. What differs is how many trees are standing on it.",
    prompt: "Which choice best describes the overall structure of the text?",
    choices: [
      "It states a claim about urban heat and then supplies evidence that the claim is mistaken.",
      "It reports the temperature difference between shaded and unshaded pavement.",
      "It describes a measurable effect, explains its causes, and then observes that the effect is unequally available.",
      "It weighs two competing theories of how trees cool the air and endorses one of them."
    ],
    answer: 2,
    explanation: "Shade and transpiration explain the cooling, and the second half of the text turns to where canopy actually exists, ending on the block-by-block inequality. Shade and transpiration are not rival theories; the text credits both at once.",
    traps: [
      "The cooling claim is explained and extended, never refuted",
      "This restates the opening observation rather than describing the arrangement",
      "Supported",
      "Shade and transpiration are presented as joint causes, not competitors"
    ]
  },
  {
    id: "tsp-24",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 2,
    stimulus: "Every translation of a play is also a decision about performance. A translator working from a verse drama has to choose whether to preserve the meter, which will make the lines sound formal to a modern audience, or to break it, which will make them sound spoken but will surrender the pressure the meter puts on each phrase. Neither option is neutral, and no third option escapes the choice. This is why a company staging the same play twice within a decade may commission two translations rather than reuse one. The text has not changed. What the company wants an audience to hear has.",
    prompt: "Which choice best states the function of the final sentence in the text as a whole?",
    choices: [
      "It concedes that a single translation can serve any staging equally well.",
      "It locates the reason for commissioning a new translation in the company's intentions rather than in the play itself.",
      "It explains what is surrendered when a translator abandons the original meter.",
      "It urges theater companies to stage plays in their original languages."
    ],
    answer: 1,
    explanation: "Paired with the line before it, the ending isolates what actually varies between two stagings: not the source text but the effect a company is after. That directly contradicts the idea that one translation would serve equally well, which is the practice the sentence explains away.",
    traps: [
      "The sentence explains why companies do not reuse a translation",
      "Supported",
      "That loss is described in the second sentence",
      "No recommendation about original-language performance appears"
    ]
  },
  {
    id: "tsp-25",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 2,
    stimulus: "A returning honeybee that has found a rich patch of flowers performs a tight figure-eight run on the vertical surface of the comb, waggling as she crosses the middle. The angle of that middle run relative to straight up encodes the direction of the flowers relative to the sun, and the duration of the waggle encodes the distance. Bees who follow the dance leave the hive and fly to the patch. But a hive is completely dark, and the followers press against the dancer rather than watching her. What they are reading is not a picture. It is a pattern of vibration and contact transmitted through the wax.",
    prompt: "Which choice best states the function of the final sentence in the text as a whole?",
    choices: [
      "It corrects a natural but mistaken assumption about how the information described earlier is received.",
      "It supplies the measurement from which the distance to the flowers is calculated.",
      "It argues that the waggle dance conveys no dependable information about direction.",
      "It states that vibration travels through the wax of the comb."
    ],
    answer: 0,
    explanation: "Angles and figure-eights invite the reader to imagine watching, and the darkness plus the final sentence replace watching with touch and vibration. The correction is about the channel, not the content, so the dance keeps its directional information intact.",
    traps: [
      "Supported",
      "The duration of the waggle, given in the second sentence, encodes distance",
      "The direction information stands; only how it is received is revised",
      "This repeats the sentence's own content instead of naming its function"
    ]
  },
  {
    id: "tsp-26",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 3,
    stimulus: "When a historian of a region without written records interviews the last people who remember a displaced village, the resulting testimony is often treated as a supplement, useful color hung on a frame built from documents. The order can just as easily be reversed. Documents produced by an administration record what that administration counted, taxes assessed, households registered, boundaries drawn, and fall silent about everything it had no reason to count. Testimony is uneven and reshaped by decades of retelling, but it is uneven in different places than the archive is. Used together, each set of gaps becomes a way of noticing what the other has quietly left out.",
    prompt: "What is the main purpose of the text?",
    choices: [
      "To establish that oral testimony is a more reliable source than administrative documents",
      "To describe the specific categories that tax administrations recorded",
      "To explain why the village discussed by the historian was displaced",
      "To argue that two kinds of sources are most useful when used to expose each other's blind spots"
    ],
    answer: 3,
    explanation: "The text grants that testimony is uneven and that documents are selective, then makes the mismatch between their gaps the reason to read them against each other. It never ranks the two, since its point depends on each one failing where the other does not.",
    traps: [
      "The text declines to rank them and calls testimony uneven in its own way",
      "Those categories are an example inside the argument, not its purpose",
      "The displacement is mentioned only to set up the interview",
      "Supported"
    ]
  },
  {
    id: "tsp-27",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 3,
    stimulus: "Programs that pay farmers to store carbon in their soil depend on someone being able to say how much carbon is actually there. The standard method takes a core, dries it, and burns the sample to measure what is released, and it is accurate for the precise spot where the core was taken. Soil carbon, however, varies over distances of a few meters, so a whole field's total depends on the sampling scheme chosen, and two defensible schemes applied to one field can differ by a fifth. This is not a reason to abandon measurement. It is a reason that contracts written as though a field held one exact number will end up disputed.",
    prompt: "Which choice best states the function of the final sentence in the text as a whole?",
    choices: [
      "It concludes that soil carbon cannot be measured with any useful accuracy.",
      "It converts the technical limitation described earlier into a practical warning about how agreements are worded.",
      "It explains the procedure by which a soil core is dried and then burned.",
      "It notes that two sampling schemes applied to one field can differ by a fifth."
    ],
    answer: 1,
    explanation: "The sentence takes the sampling variation established in the middle of the text and says what follows from it for the contracts named in the opening line. The sentence before it explicitly refuses the stronger conclusion that measurement should be abandoned.",
    traps: [
      "The preceding sentence rules that conclusion out directly",
      "Supported",
      "That procedure is described in the second sentence",
      "This restates the finding instead of naming what the closing sentence does with it"
    ]
  },
  {
    id: "tsp-28",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 3,
    stimulus: "The following text is adapted from a 2016 novel. Theo is describing the summer his family spent at his uncle's house.\n\nNothing unusual happened that July, which is why I have never understood why the others speak of it the way they do. My uncle was generous. He gave my sister the larger room without being asked, and when she wanted the smaller one after all he had her things carried back the same afternoon, twice in one week, and never complained about it where we could hear. My mother left early, but my mother always left early. I have gone over that month many times and I can find nothing in it that would not fit inside an ordinary summer.",
    prompt: "Which choice best describes the overall structure of the text?",
    choices: [
      "A narrator states a conclusion, offers details meant to support it, and reasserts the conclusion, though the details invite another reading.",
      "A narrator recounts an alarming event and then explains how his family recovered from it.",
      "A narrator describes his uncle's generosity in arranging which room his sister would occupy.",
      "A narrator describes a single afternoon closely and draws a general conclusion about his family."
    ],
    answer: 0,
    explanation: "Theo opens and closes by insisting the month was ordinary, and the evidence between, a sister moved twice in a week and a mother who left early, works against him. He recounts no alarming event, which is precisely his claim, so any structure built on one misreads the passage.",
    traps: [
      "Supported",
      "Theo insists nothing happened, and no recovery is described",
      "This restates one supporting detail instead of describing the arrangement",
      "The passage covers a month, and no general claim about the family is made"
    ]
  },
  {
    id: "tsp-29",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 3,
    stimulus: "Two counties sit on either side of a state line, share a single labor market, and until 2019 had the same minimum wage. That year one state raised its rate and the other did not. Economists have used such borders for decades, because a pair like this supplies what a national comparison cannot: two populations alike in nearly everything except the policy. The design is not airtight. Employers near a border can shift hours across the line more easily than employers elsewhere, which is exactly the sort of response the study is trying to measure. What the border buys is not certainty. It is a comparison whose remaining objections can be named.",
    prompt: "Which choice best states the function of the final sentence in the text as a whole?",
    choices: [
      "It withdraws the criticism raised in the preceding sentences.",
      "It explains how employers near a border are able to shift hours across it.",
      "It states in qualified terms what the method actually achieves, after the text has both praised and criticized it.",
      "It recommends that economists stop relying on border comparisons."
    ],
    answer: 2,
    explanation: "Having credited the design and then named its weakness, the text closes by settling on a modest claim: not proof, but a comparison whose limits are specifiable. That is neither a withdrawal of the criticism nor an abandonment of the method.",
    traps: [
      "The criticism is kept and folded into the modest final claim",
      "That explanation appears in the fifth sentence",
      "Supported",
      "The sentence defends a limited use of the method rather than rejecting it"
    ]
  },
  {
    id: "tsp-30",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 3,
    stimulus: "The red pigment on a cave wall looks like a single material, but ochre is not one thing. Its color depends on the proportion of iron oxides to clay minerals in the deposit it came from, and those proportions vary from outcrop to outcrop closely enough that a fleck lifted from a painting can be matched to a source. In one cave the matching produced an awkward result: pigment from the deepest chamber came from a deposit ninety kilometers away, while a bed of perfectly usable ochre lies within an hour's walk of the entrance. Whatever governed that choice, it was not availability.",
    prompt: "Which choice best states the function of the final sentence in the text as a whole?",
    choices: [
      "It identifies the specific belief that led the painters to prefer distant ochre.",
      "It draws the one inference the matching result compels, without proposing what did govern the choice.",
      "It reports that a bed of usable ochre lies near the entrance of the cave.",
      "It explains how iron oxides and clay minerals determine a pigment's color."
    ],
    answer: 1,
    explanation: "With usable ochre an hour away and the pigment traced ninety kilometers off, convenience is eliminated, and the sentence says only that. It names no belief, which is why the choice that supplies one goes beyond the text.",
    traps: [
      "No belief or motive is identified anywhere in the passage",
      "Supported",
      "This restates a detail from the preceding sentence",
      "That explanation is given in the second sentence"
    ]
  },
  {
    id: "tsp-31",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 3,
    stimulus: "An Antarctic ice core is read downward like a calendar: each summer's snow differs enough from each winter's that the layers can be counted much as tree rings are. Below roughly eight hundred meters the layers thin under their own weight until counting fails altogether. At that depth the record does not end, but the method of dating it must change. Volcanic ash from eruptions dated elsewhere appears as thin dark bands, and dust blown from distant deserts arrives in pulses whose chemistry can be matched to known climate cycles. These markers do not date every year. They fix a smaller number of points, and the years between them are estimated rather than counted.",
    prompt: "Which choice best describes the overall structure of the text?",
    choices: [
      "It describes two dating techniques and argues that the older of them has been discredited.",
      "It explains that summer snow and winter snow differ enough to be told apart.",
      "It traces the history of Antarctic drilling from the earliest cores to the deepest.",
      "It presents a dating technique, identifies the depth at which it fails, describes what replaces it, and specifies the precision that replacement gives up."
    ],
    answer: 3,
    explanation: "Layer counting, its failure depth, the ash and dust markers, and the closing admission that intervening years are estimated form four steps in that order. Counting is not discredited; it works perfectly well until the layers thin.",
    traps: [
      "Layer counting remains valid above the depth where the layers thin",
      "This restates the opening detail rather than describing the arrangement",
      "No drilling history or sequence of expeditions appears",
      "Supported"
    ]
  },
  {
    id: "tsp-32",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 3,
    stimulus: "In participatory budgeting a city hands residents of a district direct authority over a slice of its capital spending. Residents propose projects, volunteers develop the proposals into costed plans, and everyone in the district votes on them. Reviews of the practice usually ask whether the money ends up well spent, and it generally does. A less common question is what happens to the people who spend a winter turning a complaint about a dark intersection into a lighting proposal with a budget and a contractor attached. Surveys in several cities find that those volunteers are markedly more likely than their neighbors to attend later public meetings on matters the program never touched.",
    prompt: "Which choice best states the function of the fourth sentence in the text as a whole?",
    choices: [
      "It pivots from the question reviews usually ask to the one the text will take up.",
      "It offers evidence that participatory budgeting spends public money effectively.",
      "It concludes that participatory budgeting fails to produce useful projects.",
      "It describes the labor involved in turning a complaint into a costed proposal."
    ],
    answer: 0,
    explanation: "The third sentence disposes of the usual question, and the fourth sets a different one in its place, which the survey findings in the last sentence then answer. It cannot be concluding that the program fails, since the sentence just before grants that the money is well spent.",
    traps: [
      "Supported",
      "That evidence is given in the third sentence",
      "The text says the money generally is well spent",
      "This restates content the sentence mentions rather than naming its role"
    ]
  },
  {
    id: "tsp-33",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 3,
    stimulus: "Restoring a silent film usually means restoring an image. The music is harder, because most silent films never had a fixed score at all. A distributor sent theaters a cue sheet, a list of moods with suggested pieces, and the house pianist or the local orchestra assembled something from whatever they owned and could play. Two audiences in the same month heard different films in every respect except the picture. Restorers who commission a new score are therefore not filling a gap in the original. They are making one of many possible performances permanent, which is precisely the thing the original arrangement was designed never to do.",
    prompt: "What is the main purpose of the text?",
    choices: [
      "To describe the process by which distributors printed and mailed cue sheets to theaters",
      "To argue that silent films ought to be screened with no music at all",
      "To explain why supplying music to a restored silent film alters the work rather than completing it",
      "To show that restoring the image of a silent film is harder than restoring its sound"
    ],
    answer: 2,
    explanation: "Because the score was never fixed, a commissioned score freezes one performance out of many, which the closing sentences call the opposite of completion. The text says outright that the music is the harder problem, so the ranking in the last choice is reversed.",
    traps: [
      "Cue sheets are one detail inside the explanation, not the purpose",
      "The text analyzes what scoring does and recommends nothing",
      "Supported",
      "The second sentence states that the music is the harder task"
    ]
  },
  {
    id: "tsp-34",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 4,
    stimulus: "Reef corals house single-celled algae that supply most of their food, and when the water warms the coral expels them and pales. For years the search for heat-tolerant reefs concentrated on finding corals whose algae could withstand higher temperatures, on the reasonable assumption that the limit lay with the symbiont. Colonies transplanted from a naturally hot lagoon have complicated that assumption. They kept their tolerance after their original algae were replaced with strains from cooler water, and colonies taken from cool water did not become tolerant when given the lagoon strains. The heat resistance travels with the animal. Which partner sets the limit is now an open question rather than a settled premise.",
    prompt: "Which choice best describes the overall structure of the text?",
    choices: [
      "It reports a discovery and then traces its practical applications in reef management.",
      "It describes a relationship, states the assumption that guided research into it, presents transplant results the assumption cannot absorb, and reopens the question.",
      "It explains that corals expel their algae and lose color when the water warms.",
      "It raises an open question and then resolves it in favor of the symbiont."
    ],
    answer: 1,
    explanation: "The partnership, the symbiont assumption, the two-way transplant result, and the closing reopening of the question follow in exactly that sequence. Nothing is resolved in the symbiont's favor; the transplants point the other way and the text stops short of a verdict.",
    traps: [
      "No management applications are discussed",
      "Supported",
      "This restates the opening detail rather than describing the arrangement",
      "The text ends by unsettling the question, and the evidence favors the animal"
    ]
  },
  {
    id: "tsp-35",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 4,
    stimulus: "The phrase Silk Roads was coined in the nineteenth century by a European geographer, and for a long time it organized scholarship along the lines the phrase suggests: routes, running east and west, carrying luxury goods between two civilizations presumed to matter. The label has proved hard to shake even as the evidence has moved away from it. Excavations at intermediate sites keep turning up dense local exchange in grain, cloth, and livestock, conducted by people who never traveled far and had no stake in either terminus. A recent generation of historians argues that the network was not a road at all but a lattice, and that silk was the least representative thing moving along it.",
    prompt: "What is the main purpose of the text?",
    choices: [
      "To establish the date and the authorship of a nineteenth-century geographical term",
      "To argue that trade in silk was the most important activity along these routes",
      "To describe the goods recovered from one intermediate excavation site",
      "To show how an inherited name has kept shaping a field whose evidence now contradicts it"
    ],
    answer: 3,
    explanation: "The coinage, the persistence of the label, the excavations that fit it badly, and the lattice revision all serve one point about a name outliving its evidence. Silk is called the least representative cargo, which reverses the claim that it was the most important.",
    traps: [
      "The coinage is background, not the point of the passage",
      "The final sentence calls silk the least representative thing carried",
      "The excavations are summarized in the aggregate, and no single site is described",
      "Supported"
    ]
  },
  {
    id: "tsp-36",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 4,
    stimulus: "A language with fourteen distinct forms of a single verb looks, to a speaker of a language with four, like an inventory to be memorized. Descriptions written for outsiders often present it exactly that way, as a table. Speakers themselves do not appear to hold a table. In elicitation they produce the rare forms fluently for situations they have never discussed, and hesitate over common forms when a situation is described ambiguously, which is the reverse of what memorized retrieval predicts. The forms seem instead to be assembled from a small number of decisions about who is acting, upon whom, and how certain the speaker is. The table is a record of the output, not a picture of the process.",
    prompt: "Which choice best states the function of the final sentence in the text as a whole?",
    choices: [
      "It states the distinction the evidence has been driving toward, separating a record of results from an account of how they are produced.",
      "It concedes that speakers do memorize a table of verb forms after all.",
      "It notes that outsider descriptions of such a language are usually laid out as tables.",
      "It proposes a new method for eliciting rare verb forms from native speakers."
    ],
    answer: 0,
    explanation: "The elicitation pattern shows retrieval failing as a model, and the last sentence names what the table really is once assembly replaces retrieval. It cannot be conceding memorization, since the sentence demotes the table to a record of output.",
    traps: [
      "Supported",
      "The sentence denies that the table describes what speakers do",
      "That observation belongs to the second sentence",
      "Elicitation is used as evidence; no new method is proposed"
    ]
  },
  {
    id: "tsp-37",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 4,
    stimulus: "When a widely cited priming result failed to replicate in a large multi-site study, two readings competed for the field's attention. One held that the original finding was a false positive produced by a small sample and flexible analysis. The other held that the effect is real but fragile, sensitive to features of the setting that the replication did not reproduce. The second reading is not obviously wrong, since effects genuinely can be context-dependent. But it is very difficult to test, because any failed replication can be attributed to some unspecified difference in conditions. A claim that survives every disconfirmation by naming a fresh hidden variable has stopped functioning as a claim about the world.",
    prompt: "Which choice best describes the function of the final sentence in the text as a whole?",
    choices: [
      "It concludes that the original priming result has now been definitively confirmed.",
      "It restates the first reading's account of small samples and flexible analysis.",
      "It explains in general terms why the second reading is objectionable despite being plausible.",
      "It proposes a study design capable of settling the dispute between the two readings."
    ],
    answer: 2,
    explanation: "The text concedes that fragility is possible and then objects that the fragility defense can absorb any result, and the last sentence states that objection as a general principle. It confirms nothing, since the original result is the thing that failed to replicate.",
    traps: [
      "The passage reports a failed replication and confirms nothing",
      "The sentence targets the second reading, not the first",
      "Supported",
      "The text diagnoses the problem and offers no design to resolve it"
    ]
  },
  {
    id: "tsp-38",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 4,
    stimulus: "A canvas long catalogued as the work of a minor member of a 1920s circle has been reassigned to the group's best-known painter, and the reasoning has less to do with style than with materials. The ground layer contains a barium compound that the workshop supplying the well-known painter began adding in 1923 and that no other supplier in the city used. Style arguments had run both ways for decades, since the circle painted deliberately alike. The pigment does not prove that the famous painter held the brush. It does establish that the canvas was prepared in her studio, which narrows the field of candidates from a movement to a household.",
    prompt: "Which choice best states the function of the final sentence in the text as a whole?",
    choices: [
      "It withdraws the reattribution announced at the beginning of the text.",
      "It specifies the limited conclusion that the material evidence actually licenses.",
      "It explains why stylistic arguments about the circle had proved inconclusive.",
      "It identifies the year in which the workshop began adding a barium compound."
    ],
    answer: 1,
    explanation: "Paired with the sentence before it, the ending marks off what the barium shows, a studio rather than a hand, and calls that a narrowing rather than a proof. It does not withdraw the reattribution; it says how far the evidence carries it.",
    traps: [
      "The reattribution stands, with its basis specified rather than revoked",
      "Supported",
      "That explanation is given in the third sentence",
      "This restates a detail from the second sentence"
    ]
  },
  {
    id: "tsp-39",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 4,
    stimulus: "A river that meanders across a floodplain erodes the outside of every bend and deposits on the inside, so the bends migrate downstream and grow more pronounced until a flood cuts across the neck and abandons the loop. Models reproduce this whole cycle from two rules about flow and sediment, and the resemblance to real rivers is striking. It is also a reason for caution. A model that reproduces a shape has shown that its rules are sufficient to generate that shape, not that they are the rules the river follows. Several groups have built convincing meanders from rules that contradict one another, and every set produces a floodplain a geologist would accept.",
    prompt: "Which choice best describes the function of the third sentence in the text as a whole?",
    choices: [
      "It turns the model's success into the basis of the warning that the rest of the text develops.",
      "It supplies the evidence that several groups have built meanders from contradictory rules.",
      "It denies that models can reproduce the shapes of real rivers.",
      "It restates the two rules about flow and sediment on which the models depend."
    ],
    answer: 0,
    explanation: "The striking resemblance reported just before becomes, in this sentence, the thing to be careful about, and the two sentences after it spell out why. It cannot deny that models reproduce river shapes, since the caution exists precisely because they do.",
    traps: [
      "Supported",
      "That evidence appears in the final sentence",
      "The text grants the resemblance and warns about what it proves",
      "The sentence does not name the rules; it responds to their apparent success"
    ]
  },
  {
    id: "tsp-40",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 4,
    stimulus: "A novel told entirely in letters gives up the ability to say what a character is thinking at the moment of action. Everything arrives afterward, written to someone, shaped by what the writer wants that reader to believe. Critics have sometimes treated this as a limitation the form must work around. The better novels in the form treat it as the subject. When two correspondents describe the same afternoon and their accounts do not agree, the reader is not being asked to determine what happened. The reader is being shown that each account was composed by someone with a reader in mind, which is equally true of the letters that do agree.",
    prompt: "Which choice best describes the overall structure of the text?",
    choices: [
      "It compares two novels written in letters and judges one of them more successful.",
      "It explains that letters in such novels are written after the events they describe.",
      "It defends the critical view that the epistolary form is a limitation to be overcome.",
      "It identifies a constraint of a literary form, reports a common critical response, and argues that the strongest works make the constraint their material."
    ],
    answer: 3,
    explanation: "The lost access to thought is the constraint, the critics supply the standard response, and the disagreeing letters show the form turning that constraint into its theme. The text sets itself against the critics rather than defending them.",
    traps: [
      "No particular novels are named or ranked",
      "This restates a supporting detail rather than describing the arrangement",
      "The fourth sentence turns against that view",
      "Supported"
    ]
  },
  {
    id: "tsp-41",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 4,
    stimulus: "Early evaluations of microcredit reported large gains in household income, and the programs spread quickly on the strength of those numbers. Later evaluations that randomly assigned villages to receive lending or not found much smaller average effects, and the enthusiasm cooled. Both sets of numbers are defensible, because they measure different things. The early studies compared borrowers with non-borrowers, and people who seek a loan differ from those who do not in ways no survey captures. The randomized studies removed that difference and, in doing so, also averaged over the minority of borrowers for whom credit proved transformative. A small average can conceal a large effect that reaches very few people.",
    prompt: "What is the main purpose of the text?",
    choices: [
      "To establish that the earliest microcredit evaluations were fabricated",
      "To report that randomized studies found smaller average effects than earlier studies did",
      "To explain how two bodies of evidence that appear to conflict are each measuring something the other misses",
      "To recommend that lenders concentrate their lending on borrowers likely to benefit most"
    ],
    answer: 2,
    explanation: "The text calls both sets of numbers defensible and then names what each design captures and what it hides, resolving the apparent conflict without discarding either. Calling the early work fabricated contradicts the explicit statement that both sets are defensible.",
    traps: [
      "The text calls both sets of numbers defensible",
      "This restates one finding rather than naming the overall purpose",
      "Supported",
      "The text diagnoses the disagreement and issues no lending advice"
    ]
  },
  {
    id: "tsp-42",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 4,
    stimulus: "Male white-crowned sparrows in neighboring valleys sing versions of the same song that differ in the trill at the end, and the boundaries between versions are sharp enough to map. The obvious explanation is isolation: birds that rarely meet drift apart. Recordings collected over thirty years fit that explanation poorly. The dialect boundaries have stayed in place while the birds themselves have not, since males banded as juveniles regularly settle across a line and then sing the local version rather than the one they hatched under. The boundary is maintained by learning rather than by separation, which means it can persist between populations that mix freely.",
    prompt: "Which choice best describes the function of the third sentence in the text as a whole?",
    choices: [
      "It supplies the banding evidence about where juvenile males eventually settle.",
      "It signals that the straightforward explanation just offered will be overturned by the evidence that follows.",
      "It confirms that isolation accounts for the difference between the valleys.",
      "It notes that recordings of the sparrows now span thirty years."
    ],
    answer: 1,
    explanation: "The isolation account is introduced as obvious and this sentence announces that it fits badly, after which the banding data and the learning conclusion arrive. It cannot confirm isolation, since the sentence exists to say the record does not support it.",
    traps: [
      "That evidence is given in the fourth sentence",
      "Supported",
      "The sentence says the recordings fit the isolation account poorly",
      "This restates the sentence's detail instead of naming its function"
    ]
  },
  {
    id: "tsp-43",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 5,
    stimulus: "An animal's resting metabolic rate rises with its mass, but more slowly than mass itself: a creature ten thousand times heavier than another burns roughly a thousand times more energy, not ten thousand. A celebrated model derives that ratio from the geometry of the branching networks that deliver fuel to tissue, and the derivation is elegant enough that the exponent it predicts is routinely called a law. Compilations assembled since suggest that the exponent is not a single number. It differs between birds and mammals, between resting and growing animals, and drifts within one lineage across body sizes. The pattern is real. What the model explained may be its average rather than its cause.",
    prompt: "Which choice best states the function of the final sentence in the text as a whole?",
    choices: [
      "It concedes the phenomenon while restricting what the celebrated model can be credited with explaining.",
      "It rejects the claim that metabolic rate rises with body mass at all.",
      "It lists the groups between which the exponent has been found to differ.",
      "It proposes a replacement model derived from the chemistry of tissue."
    ],
    answer: 0,
    explanation: "Paired with the concession that the pattern is real, the closing line separates a genuine regularity from a claim to have identified its mechanism and grants the model only the former. It cannot reject the mass relationship, which the sentence before it affirms.",
    traps: [
      "Supported",
      "The preceding sentence affirms that the pattern is real",
      "That list appears in the fourth sentence",
      "No alternative model is offered anywhere in the text"
    ]
  },
  {
    id: "tsp-44",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 5,
    stimulus: "A common-law court is bound by earlier decisions, which sounds like a rule that would freeze the law in place. In practice the binding element of a prior case is its holding, and the holding must be extracted from an opinion that also contains reasoning, description, and remarks not strictly necessary to the outcome. Two later courts reading the same opinion can extract holdings of very different width. A court that wishes to depart from a precedent it cannot overrule often does not confront it at all; it reads the earlier holding narrowly, finds a fact the present case does not share, and distinguishes. Constraint and change are produced by the same operation.",
    prompt: "What is the main purpose of the text?",
    choices: [
      "To argue that courts should be forbidden to distinguish earlier cases",
      "To describe the parts of a judicial opinion that fall outside its holding",
      "To explain how a doctrine that appears to prevent change is also the means by which change occurs",
      "To show that common-law courts are in practice unbound by earlier decisions"
    ],
    answer: 2,
    explanation: "The text starts from the freezing intuition, shows that holdings must be read out of opinions at variable width, and ends by identifying constraint and change as one operation. It does not conclude that courts are unbound, since distinguishing works only by taking the earlier holding seriously enough to read it.",
    traps: [
      "The text analyzes distinguishing rather than recommending its abolition",
      "Those parts are one step in the argument, not the purpose",
      "Supported",
      "Distinguishing operates within the constraint rather than escaping it"
    ]
  },
  {
    id: "tsp-45",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 5,
    stimulus: "A translation system trained on enough parallel text will render most idioms correctly, which is sometimes offered as evidence that it has learned what they mean. The evidence is weaker than it looks. Idioms are frequent and their translations are stable, so a system that has simply memorized the pairing will produce the right output without holding any representation of the figure behind it. The test that separates the two cases is not the ordinary idiom but the broken one: an idiom altered midway through a sentence in a way that a speaker would follow and extend. Systems that handle the standard form flawlessly often render the altered form word by word, as though the alteration had switched the phrase off.",
    prompt: "Which choice best describes the overall structure of the text?",
    choices: [
      "It defines a technical term and then applies that definition to two illustrative examples.",
      "It states that idioms occur frequently and that their translations remain stable.",
      "It presents a test, reports its results, and concludes that these systems do represent figurative meaning.",
      "It reports an inference drawn from a system's performance, explains why the inference does not follow, and describes a test that would tell the possibilities apart."
    ],
    answer: 3,
    explanation: "The claim about learned meaning, the memorization alternative that makes it non-binding, and the broken-idiom test arrive in that order. The results reported at the end cut against figurative representation rather than establishing it.",
    traps: [
      "No term is defined and no worked examples are given",
      "This restates a supporting detail instead of describing the arrangement",
      "The altered-idiom results tell against figurative representation",
      "Supported"
    ]
  },
  {
    id: "tsp-46",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 5,
    stimulus: "Acting styles are usually explained by taste, but a good deal of what changed between 1600 and 1900 can be traced to the room. An open-air playhouse seating two thousand in daylight, with spectators on three sides and none of them more than fifteen meters from the platform, rewards an actor who turns constantly, who is audible without shouting, and who can be watched from behind. A nineteenth-century proscenium house, dark and deep and facing one way, rewards an actor who holds still and projects forward. Neither building produced a style by itself. But a style that fought the building it played in did not survive long enough to be recorded as a style.",
    prompt: "Which choice best states the function of the final sentence in the text as a whole?",
    choices: [
      "It abandons the argument that theater architecture influenced acting style.",
      "It qualifies the text's causal claim while preserving it, explaining how buildings shaped style without determining it.",
      "It describes the sightlines available to spectators in an open-air playhouse.",
      "It attributes the disappearance of open-air playhouses to changes in public taste."
    ],
    answer: 1,
    explanation: "The sentence before concedes that no building produces a style, and the closing but restores the influence in a weaker form: buildings filter which styles last. Abandoning the architectural claim would leave the closing sentence with nothing to do.",
    traps: [
      "The word but restores the architectural claim rather than dropping it",
      "Supported",
      "Those sightlines are described in the second sentence",
      "The disappearance of the playhouses is never discussed"
    ]
  },
  {
    id: "tsp-47",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 5,
    stimulus: "Two proxies for ocean temperature during the last interglacial disagree by about two degrees. One reads the ratio of magnesium to calcium in the shells of surface-dwelling plankton; the other reads the composition of organic molecules produced by algae. Because the disagreement is systematic rather than scattered, it is unlikely to be noise. Each proxy is calibrated against modern water, and each records not temperature alone but temperature during the season and at the depth where its organism happens to grow. If those seasons have shifted differently since the interglacial, both proxies could be accurate and still disagree. The gap may be measuring a change in the ocean rather than an error in the method.",
    prompt: "Which choice best states the function of the final sentence in the text as a whole?",
    choices: [
      "It reframes the discrepancy the text has described as a possible finding rather than a flaw.",
      "It concludes that one of the two proxies must have been miscalibrated.",
      "It explains that each proxy records the season and the depth at which its organism grows.",
      "It reports that the two proxies differ by roughly two degrees."
    ],
    answer: 0,
    explanation: "Once both proxies can be accurate while disagreeing, the two-degree gap becomes information about seasonal change rather than a defect, and the last sentence states that turn. It cannot blame miscalibration, since the sentence before allows both readings to be correct.",
    traps: [
      "Supported",
      "The preceding sentence allows both proxies to be accurate",
      "That explanation appears in the fourth sentence",
      "This restates the opening measurement rather than naming a function"
    ]
  },
  {
    id: "tsp-48",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 5,
    stimulus: "A census category is presented as a container for people who already exist, and in a narrow sense it is. But the form is answered by households who read the options and locate themselves among them, and the options available in one decade were not available in the last. When a category is added, people appear in it who previously appeared elsewhere, and the resulting series shows a group growing when what has changed is the instrument. Demographers know this and adjust for it. The harder point is that after two or three decades of a category being offered, taught in schools, and used to allocate funds, the container has helped make the thing it counts.",
    prompt: "What is the main purpose of the text?",
    choices: [
      "To warn that census data are too unreliable to support demographic research",
      "To describe how demographers adjust a series when a new category is introduced",
      "To argue that a measurement instrument can, over time, help produce what it was built to record",
      "To recommend that census categories be held fixed across decades"
    ],
    answer: 2,
    explanation: "The text grants that the counting artifact is known and correctable, then presses past it to the slower effect by which an offered category shapes the population it measures. It does not condemn census data, since it credits demographers with handling the first problem.",
    traps: [
      "The text credits demographers with adjusting for the problem it names",
      "That adjustment is one step in the argument, not its purpose",
      "Supported",
      "No recommendation about census design is offered"
    ]
  },
  {
    id: "tsp-49",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 5,
    stimulus: "A novel published in monthly parts had to end each installment in a state that would make a reader buy the next one, and critics have long treated that requirement as a distortion, commerce bending art. The bending is visible enough. Chapters conclude on a threshold; characters vanish for an issue and return. What the complaint misses is that the interval belonged to the reader as much as to the publisher. Four weeks with a suspended situation is four weeks of forming expectations, and a novelist who understood this could arrange a revelation to land against guesses the reader had spent a month building. That effect cannot be reproduced by reading the same pages in a weekend.",
    prompt: "Which choice best describes the overall structure of the text?",
    choices: [
      "It describes a publishing format and traces its decline across the nineteenth century.",
      "It observes that chapters in serialized novels frequently end on a threshold.",
      "It defends the critical view that commercial pressure distorted the serialized novel.",
      "It presents a standard criticism of a publishing format, grants its factual basis, and argues that the criticism overlooks an effect the format made possible."
    ],
    answer: 3,
    explanation: "The distortion complaint comes first, the visible bending concedes it, and the month of accumulated expectation is offered as something the complaint cannot see. The text works against that criticism rather than defending it.",
    traps: [
      "No decline or chronology of the format is described",
      "This restates a conceded detail instead of describing the arrangement",
      "The fourth sentence turns the argument against that view",
      "Supported"
    ]
  },
  {
    id: "tsp-50",
    skillId: "text-structure-purpose",
    domain: "craft-structure",
    difficulty: 5,
    stimulus: "Reports that trees trade sugar through fungal threads and warn one another of insect attack have moved quickly from journals into general circulation. Something real underlies them: fungi do connect roots, and labeled carbon injected into one tree does turn up in another. What the popular account adds is direction and intent, a donor, a recipient, and a message. The tracer experiments do not establish that. Carbon leaving one tree and appearing in another may have passed through a fungus with a budget of its own, which is not a courier. The claim that a forest is a network is safe. The claim that it is a conversation is not.",
    prompt: "Which choice best describes the function of the fifth sentence in the text as a whole?",
    choices: [
      "It supplies the strongest available evidence that trees deliberately feed one another.",
      "It offers an alternative account of the tracer results that does not require the intent the popular version assumes.",
      "It restates the finding that labeled carbon injected into one tree appears in another.",
      "It closes the text by distinguishing a claim that is safe from one that is not."
    ],
    answer: 1,
    explanation: "The sentence before says the tracers establish no intent, and this one shows why by routing the carbon through a fungus acting on its own account. It is not the text's closing distinction, which the last two sentences make separately.",
    traps: [
      "The sentence removes the deliberate feeding reading rather than supporting it",
      "Supported",
      "This repeats content from the second sentence instead of naming a function",
      "That work is done by the final two sentences, not this one"
    ]
  }
]
