// Sample articles for the seeder: 5 per category. Each is [title, summary, body].
const SEED_ARTICLES = {
  Politics: [
    ['Parliament passes the national budget after a late-night vote', 'Lawmakers approved next year\'s budget by a narrow margin following hours of debate.', 'The budget passed with 61 votes in favor after the opposition failed to secure amendments on housing and transport.\n\nThe finance minister said the plan balances growth with a lower deficit, while critics warned about cuts to local councils.'],
    ['Coalition leaders agree on a new election reform bill', 'A cross-party deal would change how seats are allocated in the next election.', 'Party leaders announced a compromise on the election reform bill after three weeks of closed-door talks.\n\nThe bill still needs approval in two readings before it can take effect.'],
    ['Mayors demand more funding for local infrastructure', 'City leaders met in the capital to ask for a bigger share of the state budget.', 'Mayors from twelve cities said aging roads and water systems can no longer wait.\n\nThe government promised to review the request before the end of the quarter.'],
    ['Foreign minister begins a regional diplomatic tour', 'The week-long trip will include meetings on trade and border cooperation.', 'The foreign minister will visit four countries, with trade agreements at the top of the agenda.\n\nOfficials described the tour as an effort to strengthen regional partnerships.'],
    ['New transparency law requires public officials to publish meetings', 'Officials will have to list their meetings with lobbyists each month.', 'The law takes effect in January and applies to ministers and senior advisers.\n\nWatchdog groups welcomed the move but asked for stronger penalties for missing reports.'],
  ],
  Economy: [
    ['Inflation slows for the third month in a row', 'Consumer prices rose more slowly as food and fuel costs eased.', 'The statistics bureau reported annual inflation of 2.9 percent, down from 3.4 percent.\n\nEconomists expect the central bank to hold interest rates at its next meeting.'],
    ['Central bank keeps interest rates unchanged', 'The bank said it wants more evidence that price growth is under control.', 'The decision was widely expected by analysts.\n\nThe governor noted that the labor market remains strong, but global uncertainty is high.'],
    ['Small businesses report a rise in online sales', 'A new survey shows more local shops selling through their own websites.', 'Nearly half of surveyed shop owners said online orders now make up a fifth of revenue.\n\nMany said delivery costs are still their biggest challenge.'],
    ['Housing prices climb in major cities for the fifth quarter', 'Demand for apartments keeps outpacing new construction.', 'Average prices rose 1.8 percent in the last quarter, led by the central region.\n\nDevelopers say approval delays are slowing new projects.'],
    ['Export growth reaches a two-year high', 'Technology and agriculture exports led the increase.', 'Exports grew 6 percent compared with last year, according to official figures.\n\nThe trade ministry credited new agreements with several Asian markets.'],
  ],
  Military: [
    ['Air force completes large joint training exercise', 'Pilots from three allied countries took part in the ten-day drill.', 'The exercise focused on coordination, rapid response and night operations.\n\nCommanders said the drill improved cooperation between the participating units.'],
    ['Army begins testing new lightweight body armor', 'Soldiers will trial the gear over the next six months.', 'The new armor is 20 percent lighter than the current model while keeping the same protection level.\n\nFeedback from the trial will guide a decision on wider purchase.'],
    ['Navy welcomes a new patrol vessel to its fleet', 'The ship will be used for coastal security and rescue missions.', 'The vessel was built domestically and is equipped with modern radar and communication systems.\n\nIt will be based at the northern port.'],
    ['Defense ministry announces a cyber defense unit expansion', 'More than 300 new positions will be opened for technical recruits.', 'The expansion aims to protect critical infrastructure from online attacks.\n\nRecruitment will start next month with a focus on engineering graduates.'],
    ['Veterans\' program offers new job training', 'Former soldiers can now join paid courses in technology and logistics.', 'The program is funded jointly by the ministry and several private companies.\n\nOrganizers expect about 1,500 participants in the first year.'],
  ],
  World: [
    ['Leaders gather for the annual climate summit', 'Delegates from more than 150 countries opened talks on emission targets.', 'The summit opened with calls for faster action on cutting emissions.\n\nSeveral countries are expected to announce new commitments this week.'],
    ['Flood relief efforts continue across the region', 'Rescue teams are delivering food and clean water to affected towns.', 'Thousands of residents remain in temporary shelters after heavy rain.\n\nInternational aid groups have sent supplies and medical staff.'],
    ['Two neighboring countries sign a new trade agreement', 'The deal removes tariffs on hundreds of goods.', 'Officials called the agreement a major step toward closer economic ties.\n\nThe agreement will be reviewed by both parliaments before it takes effect.'],
    ['Global airlines report record passenger numbers', 'Air travel has returned above pre-pandemic levels.', 'The industry association said summer demand was the highest on record.\n\nAirlines warn that crowded airports and staff shortages remain a problem.'],
    ['International talks aim to ease border tensions', 'Diplomats met for a second round of negotiations this week.', 'Both sides described the atmosphere as constructive.\n\nA third round is planned for next month in a neutral city.'],
  ],
  Technology: [
    ['Startup unveils a battery that charges in ten minutes', 'The company says the design could cut electric car charging times dramatically.', 'Engineers presented a prototype that reached 80 percent charge in under ten minutes.\n\nIndependent labs will test the claim before mass production is considered.'],
    ['Universities launch a shared supercomputing center', 'Researchers will be able to run large simulations at lower cost.', 'The center combines the resources of five universities.\n\nIt will support projects in medicine, climate science and engineering.'],
    ['New app helps farmers predict crop disease', 'The tool uses photos taken with a phone to spot early signs of disease.', 'Farmers upload a picture of a leaf and receive a diagnosis within seconds.\n\nThe developers say early tests were accurate in nine of ten cases.'],
    ['Cities test self-driving shuttles on public roads', 'Small autonomous buses will carry passengers on fixed routes.', 'The pilot will run for six months in two cities, with a safety driver on board.\n\nOfficials will review the results before expanding the service.'],
    ['Security researchers warn about a widespread router flaw', 'Users are urged to update their devices as soon as possible.', 'The flaw allows attackers to take control of affected routers remotely.\n\nManufacturers have released fixes, and users can install them from the device settings.'],
  ],
  Sports: [
    ['Local team wins the national championship in overtime', 'A last-minute goal gave the home side its first title in twelve years.', 'The match was tied until the final minute of overtime, when the striker scored from close range.\n\nThousands of fans celebrated in the city center.'],
    ['Young sprinter breaks the national record', 'The 19-year-old finished the 100 meters in 10.05 seconds.', 'The record had stood for 14 years.\n\nThe athlete said the result was the product of years of steady training.'],
    ['Basketball league announces a new season schedule', 'The season will open in October with sixteen teams.', 'Organizers added more weekend games to attract bigger crowds.\n\nTickets for the opening round go on sale next week.'],
    ['Marathon draws record number of runners', 'More than 40,000 people took part in this year\'s race.', 'Runners from 60 countries crossed the finish line under sunny skies.\n\nOrganizers said a record sum was raised for local charities.'],
    ['Swimming federation opens new training pool for youth', 'The facility will offer free lessons to children from nearby schools.', 'The pool includes a competition lane and a shallow area for beginners.\n\nThe federation hopes to find the next generation of swimmers.'],
  ],
  Culture: [
    ['City museum opens an exhibition of modern photography', 'More than 100 works from local and international artists are on display.', 'The exhibition explores daily life in cities over the last fifty years.\n\nIt will remain open until the end of the year.'],
    ['Annual film festival announces its lineup', 'Twenty-four films will compete for the main prize.', 'The program includes documentaries, dramas and a series of short films by first-time directors.\n\nThe festival opens on the first weekend of next month.'],
    ['Famous novelist releases a long-awaited new book', 'The novel, the author\'s first in seven years, went straight to the top of the charts.', 'Critics praised the book for its warm tone and sharp observation.\n\nThe author will tour several cities to meet readers.'],
    ['Orchestra performs a free open-air concert', 'Thousands gathered in the central park to hear classical favorites.', 'The program included works by Beethoven and Dvorak.\n\nThe orchestra plans to repeat the event every summer.'],
    ['Old theater reopens after a two-year restoration', 'The historic building has been renovated with its original details.', 'The reopening night featured a new play written for the occasion.\n\nThe theater now offers discounted tickets for students.'],
  ],
  Health: [
    ['Study links daily walking to better heart health', 'Researchers found that 30 minutes of walking lowered risk for adults over 50.', 'The study followed 12,000 participants for eight years.\n\nDoctors say even short walks can bring benefits when done regularly.'],
    ['Hospitals expand services to reduce waiting times', 'New clinics will open on weekends to handle routine appointments.', 'The health ministry said the change should shorten waits by up to a third.\n\nMore nurses and technicians will be hired for the new hours.'],
    ['Vaccination campaign begins for the winter season', 'Residents can book a free flu shot at local clinics.', 'Health officials urge older adults and people with chronic conditions to get vaccinated.\n\nThe shots are available without an appointment at most clinics.'],
    ['Nutrition experts recommend less sugar in school meals', 'A new guideline sets limits on sugary drinks and desserts.', 'Schools will have two years to adjust their menus.\n\nParents groups welcomed the guideline, and some asked for more fresh produce.'],
    ['Sleep researchers say a regular schedule matters most', 'Going to bed at the same time each night improved mood and focus.', 'The research tracked 800 adults using wearable sleep monitors.\n\nExperts advise avoiding screens in the hour before bed.'],
  ],
};

module.exports = SEED_ARTICLES;
