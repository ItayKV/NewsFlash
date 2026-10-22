// Sample comment texts for the seeder. They are general enough to fit any news article.
// Every text is at most 1000 characters and every name at most 50 (the Comment model checks it).

// Names guests type when they comment.
const GUEST_NAMES = [
  'Avi', 'Shira M.', 'Daniel', 'Yael', 'Tom Baker', 'Lior', 'Michal R.', 'Eitan', 'Sarah', 'Guy',
  'Tamar', 'Jonathan K.', 'Rotem', 'Hila', 'Amir', 'Rachel', 'Nadav', 'Keren', 'David S.', 'Inbal',
];

// What readers write: guests, and reporters or editors commenting as readers on someone else's article.
const READER_COMMENTS = [
  'Thanks for the clear explanation. I finally understand what this is actually about.',
  'Great reporting. I would love to see a follow-up in a few months to find out what really changed.',
  'I am not sure I agree. The article only gives one side of the story, and the critics deserve more space.',
  'Does anyone know when this is supposed to take effect? The article does not say.',
  'Very interesting read. Shared it with my family.',
  'This affects my neighborhood directly. Nobody asked the residents before deciding.',
  'Finally some good news!',
  'The numbers in the third paragraph are surprising. Where do they come from?',
  'I have been following this story for a while, and this is the best summary I have seen so far.',
  'Sounds good on paper. Let us see if it actually happens this time.',
  'Well written, but the headline is a bit dramatic compared to the content.',
  'Can you add a link to the full report?',
  'My brother works in this field and says the situation is even more complicated than described here.',
  'Important topic. Thank you for covering it.',
  'Two questions:\n1. Who is paying for this?\n2. What happens if it does not work?',
  'I read this on the train this morning. It sparked a long discussion with the person sitting next to me.',
  'The photo is great, by the way.',
  'This is exactly the kind of story we need more of.',
  'I disagree with the conclusion, but the article explains both positions fairly.',
  'Remember when they promised the same thing two years ago?',
  'Short and to the point. Thanks.',
  'Would be interesting to compare this with what other countries are doing.',
  'As a teacher, I can say that this will make a real difference for many students.',
  'Not convinced. It feels like the details are still missing.',
  'Good to see someone asking the hard questions.',
  'I live nearby and can confirm: it has been like this for months.',
  'Is there a way for the public to give feedback on this?',
  'The quote from the expert at the end says it all.',
  'Bookmarking this. I will come back to it when the decision is final.',
  'Thank you for not making this political. Just the facts.',
];

// The article's own reporter answering readers.
const AUTHOR_REPLIES = [
  'Thanks for reading! We will publish a follow-up as soon as there is an official decision.',
  'Good question. The full report has not been published yet; we will add a link once it is out.',
  'Thank you for the feedback. Both sides were asked for comment, and the response we received is quoted in the article.',
  'Reporter here: the numbers come from the official annual report, published last month.',
  'Thanks! If you have more information about how this affects your area, please contact the newsroom.',
  'Appreciate the kind words. We will keep following this story.',
];

// Editors' notes about the article.
const EDITOR_NOTES = [
  'Editor\'s note: this article was updated with a response that arrived after publication.',
  'Editor\'s note: a reminder to keep the discussion respectful. Comments with personal attacks will be removed.',
  'Editor\'s note: a figure in the fourth paragraph was corrected after a reader pointed it out. Thank you.',
  'Editor\'s note: more coverage of this topic is available in our Politics and Economy sections.',
];

module.exports = { GUEST_NAMES, READER_COMMENTS, AUTHOR_REPLIES, EDITOR_NOTES };
