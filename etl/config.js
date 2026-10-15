/* ============================================================================
   config.js: the only file you should normally need to edit.
   Site names, groupings, theme keywords and thresholds all live here.
   ========================================================================== */

/* ---------------------------------------------------------------------------
   1. SITE CANON
   Microsoft Forms lets people free-type branch names, so the same lab arrives
   under several spellings.
   Left  = whatever appears in the export (lower-cased, spaces collapsed)
   Right = the single canonical site name used everywhere in the dashboard.

   NOTE ON "Lagos": some respondents answer just "Lagos", which could mean any
   of three Lagos branches. It is deliberately NOT merged into one of them; it
   is kept as its own row and flagged in the Data Quality panel.

   (Public demo: every branch here is fictional.)
--------------------------------------------------------------------------- */
const SITE_CANON = {
  'lekki':            'Lekki',
  'lekki phase 1':    'Lekki',
  'yaba':             'Yaba',
  'yaba, lagos':      'Yaba',
  'ikorodu':          'Ikorodu',
  'ikorodu, lagos':   'Ikorodu',
  'abeokuta':         'Abeokuta',
  'abk':              'Abeokuta',
  'abuja':            'Abuja Central',
  'abuja central':    'Abuja Central',
  'wuse, abuja':      'Abuja Central',
  'kano':             'Kano',
  'enugu':            'Enugu',
  'enugu gra':        'Enugu',
  'benin':            'Benin City',
  'benin city':       'Benin City',
  'calabar':          'Calabar',
  'jos':              'Jos',
  'lagos':            'Lagos (unspecified)'
};

/* Regional roll-up, for the "region" cut on the dashboard. */
const SITE_REGION = {
  'Lekki':               'Lagos',
  'Yaba':                'Lagos',
  'Ikorodu':             'Lagos',
  'Lagos (unspecified)': 'Lagos',
  'Abeokuta':            'South-West',
  'Abuja Central':       'FCT / Abuja',
  'Kano':                'North-West',
  'Enugu':               'South-East',
  'Benin City':          'South-South',
  'Calabar':             'South-South',
  'Jos':                 'North-Central'
};

/* ---------------------------------------------------------------------------
   2. HEADER MAP
   Microsoft Forms headers -> internal field names. Keys are normalised
   (non-breaking spaces removed, whitespace collapsed, lower-cased) before
   lookup, so you only need to add a new entry if Forms question TEXT changes.
--------------------------------------------------------------------------- */
const HEADER_MAP = {
  'id':                                     'sourceId',
  'start time':                             'startTime',
  'completion time':                        'completionTime',
  'email':                                  'formsEmail',
  'name':                                   'formsName',

  'which of our branches did you patronize?':                          'branchRaw',
  'category of client':                                                'clientCategory',
  'gender':                                                            'gender',
  'age range':                                                         'ageRange',
  'name of the hospital / clinic / corporate where you were serviced.':'orgRaw',

  'couriers / specimen collection':             'courierSpecimen',
  'phlebotomy / nursing - specimen collection': 'phlebotomySpecimen',
  'laboratory urgent results':                  'labUrgent',
  'laboratory routine results':                 'labRoutine',
  'call center team':                           'callCenter',
  'customer service team':                      'customerService',
  'courier service team':                       'courierService',
  'reception desk team':                        'receptionDesk',
  'phlebotomy (nursing) team':                  'phlebotomyTeam',
  'technical / lab team':                       'techLabTeam',
  'accounting / invoicing team':                'accounting',
  'marketing team':                             'marketingTeam',
  'resolution of complaints by marketing officers':'marketingResolution',

  'lab / facility accessibility':  'facilityAccessibility',
  'lab / facility cleanliness':    'facilityCleanliness',
  'lab/ facility reception area':  'facilityReception',
  'lab / facility reception area': 'facilityReception',

  'were your complaints adequately addresed ?':  'complaintsAddressed',
  'were your complaints adequately addressed ?': 'complaintsAddressed',
  'if you answered no above, please give us more details and kindly indicate the laboratory involved.':'complaintDetail',
  'how likely are you to recommend our services to a friend or colleague?':'nps',
  'do you have any suggestions to improve our service?':'suggestion',

  'please leave your email.':        'emailA',
  'please leave your phone number.': 'phoneA',
  'would you like us to contact you? if yes, kindly provide your contact details':'contactRequested',
  'your name and surname':           'respondentName',
  'email2':                          'emailB',
  'mobile / phone':                  'phoneB'
};

/* ---------------------------------------------------------------------------
   3. TOUCHPOINTS
   `group` drives which chart block the metric appears in.
--------------------------------------------------------------------------- */
const TOUCHPOINTS = [
  { key:'labUrgent',            label:'Urgent Results',                group:'Core service' },
  { key:'labRoutine',           label:'Routine Results',               group:'Core service' },
  { key:'courierSpecimen',      label:'Courier / Specimen Collection', group:'Core service' },
  { key:'phlebotomySpecimen',   label:'Phlebotomy Specimen Collection',group:'Core service' },

  { key:'callCenter',           label:'Call Centre Team',              group:'People' },
  { key:'customerService',      label:'Customer Service Team',         group:'People' },
  { key:'receptionDesk',        label:'Reception Desk Team',           group:'People' },
  { key:'courierService',       label:'Courier Service Team',          group:'People' },
  { key:'phlebotomyTeam',       label:'Phlebotomy (Nursing) Team',     group:'People' },
  { key:'techLabTeam',          label:'Technical / Lab Team',          group:'People' },
  { key:'accounting',           label:'Accounting / Invoicing Team',   group:'People' },
  { key:'marketingTeam',        label:'Marketing Team',                group:'People' },
  { key:'marketingResolution',  label:'Complaint Resolution (Marketing)',group:'People' },

  { key:'facilityAccessibility',label:'Facility Accessibility',        group:'Facility' },
  { key:'facilityCleanliness',  label:'Facility Cleanliness',          group:'Facility' },
  { key:'facilityReception',    label:'Facility Reception Area',       group:'Facility' }
];

/* ---------------------------------------------------------------------------
   4. VOICE-OF-CUSTOMER THEMES
   Applied to BOTH the complaint field and the suggestion field.
   A comment can carry more than one theme; the theme with the most keyword
   hits becomes the "primary" theme (ties broken by the order below).
--------------------------------------------------------------------------- */
const THEMES = [
  { name:'Turnaround Time / Result Delay', color:'#C62828', kws:[
    'delay','delaid','late','tat','turn around','turnaround','turn-around','waiting time','wait','slow',
    'took long','too long','taking long','takes long','take long','takes so long','takes time','take time',
    'takes days','long time','not ready','still waiting','yet to receive','yet to get','yet to see',
    'not received','haven\'t received','have not received','not been received','still haven','no result',
    'result yet','results yet','haven\'t seen','pending','days to receive','still no','on time','promptly',
    'prompt','more than 24','24hrs','24 hours','48 hours','48hrs','2 weeks','two weeks','3 days','5days','5 days',
    'sense of urgency','urgently','urgent sample','urgent investigation','urgent test','response time',
    'fast track','faster','quicker','speed','swift','asap','reduce the time','reduce the waiting',
    'stick to your time','result delivery','results transmission','send patients result','send result',
    'send our result','deliver','ready in','be ready','when due','timely','time it takes'] },

  { name:'Communication / Follow-up / Reachability', color:'#E65100', kws:[
    'communicat','follow up','followup','follow-up','feedback','not informed','not told','no update',
    'no response','unresponsive','responsiveness','more responsive','call back','callback','kept calling',
    'never did','never sent','not resolved','not been resolved','didn\'t pick','don\'t pick','doesn\'t pick',
    'never picked','nobody picked','hardly pick','not picking','switched off','no reply','no one picks',
    'not answer','did not answer','reach out','reachout','reachable','keep us informed','inform us',
    'notification','notify','call centre','call center','please call','proactive','personal contact',
    'after sales','get across','contact us','phone number','line is'] },

  { name:'Result Accuracy / Reporting', color:'#6A1B9A', kws:[
    'wrong','error','mistake','misspell','mis-spell','spelt','spelling','incorrect','mix up','mixed up','swap',
    'inaccurate','high value','high values','query the result','incomplete result','incomplete results',
    'wrong report','rerun','re-run','not same as','vetted','signed by','normal range','reference range',
    'strange names','uniform','clinical data','requisition form','request form','report should be',
    'not indicated','discrepan'] },

  { name:'Staff Attitude / Front Desk', color:'#AD1457', kws:[
    'rude','attitude','unprofessional','unfriendly','friendly','harsh','body language','not customer centric',
    'salty','dismissive','shouted','chewing gum','preferential','queue jump','poorly trained','train your',
    'training','educated on how','more than one rep','dedicated front desk','receptive','courteous','polite',
    'empathy','gate men','gateman','ambience','front desk','reception team','customer service should',
    'attended to me','love the way','more staff','employ more','deploy more','doctors should be available'] },

  { name:'Billing / Pricing / Discounts', color:'#00695C', kws:[
    'bill','billing','payment','charge','charges','price','prices','pricing','refund','cost','costly',
    'overcharg','exorbitant','expensive','out of range with existing rates','hmo','invoice','receipt',
    'discount','promo','promotional','loyalty','referral discount','affordable','cheaper','pay '] },

  { name:'Facility / Hygiene / Signage', color:'#4527A0', kws:[
    'dirty','toilet','rest room','restroom','wash hand','hygiene','smell','unclean','clean','cleaner','cleaning',
    'sign board','signboard','signage','hidden','hiden','difficult to locate','locate the lab','find it difficult',
    'publicity','paint','facility needs','environment','waiting area','seating','parking','space','spacing',
    'branch at','new branch','open a','another branch'] },

  { name:'IT / Network / Portal', color:'#0277BD', kws:[
    'network','offline','downtime','down time','server','portal','online portal','website','app',
    'e-receipt','electronic receipt','email the result','sent to the portal','it issue','system',
    'to our email','to my email','via email','result to my mail','sent to my mail','email address'] },

  { name:'Sample Logistics / Courier', color:'#558B2F', kws:[
    'courier','couriers','sample pickup','sample pick up','pick up sample','picking up sample','pickup',
    'sample was not suitable','sample bottle','specimen container','specimen collection site','sample type',
    'newborn','blood sample','collection site','sample collector','sample collectors','no growth','subculture',
    're-bleed','rebleed','preserve sample','transport','logistics','ughelli','sent to sa','send away',
    'samples you send'] },

  { name:'Test Menu / Equipment Availability', color:'#4E342E', kws:[
    'machine','machines','repair','equipment','not available','unavailable','scanning','scan','localize',
    'localise','local','outsourc','send to south africa','test menu','offer the test','do the test here',
    'electrolyte','cortisol','histology','not carried out','can not do','cannot do','capacity'] },

  { name:'Praise / Positive Mention', color:'#2E7D32', kws:[
    'thank you','thanks','well done','keep it up','keep up','keep doing','excellent','impressed','top notch',
    'improvement','improved','keep improving','better now','efficient','great service','doing great',
    'doing well','doing extremely well','all thanks to','commend','appreciate','wonderful','good job',
    'am satisfied','i am satisfied','very satisfied','quite satisfied','satisfactory','satisfied with',
    'service is okay','service is good','you guys are doing','no complaint','love the way','nice','best'] }
];

/* Text that is a non-answer rather than real feedback. */
const NULL_TEXT = new Set([
  '','-','.','..','...','n','na','n/a','n.a','n.a.','nil','none','no','nope','nothing','not applicable',
  'not at all','no comment','no comments','no suggestion','no suggestions','none for now','none at the moment',
  'not at the moment','nan','null','yes','ok','okay','fine','good','great','all good','all correct','non','nill',
  'test','clara test','x','xx','no idea','maybe','same','as usual'
]);

/* ---------------------------------------------------------------------------
   5. THRESHOLDS
--------------------------------------------------------------------------- */
/* Whether respondent contact details appear in the PUBLISHED build.
   false  = names/emails/phones are stripped from dist/ entirely. The full,
            unmasked callback list is still written to private/service-recovery.csv,
            which is never deployed. This is the right setting for any Netlify
            URL that is not behind a password.
   'mask' = first name + initials, masked email/phone appear on the page.
   Never set this to true. */
const PUBLISH_CONTACT_DETAILS = false;

/* ---------------------------------------------------------------------------
   THRESHOLDS

   IMPORTANT, PLEASE READ BEFORE QUOTING THESE NUMBERS
   ---------------------------------------------------
   `npsTarget` and `satisfactionTarget` are PLACEHOLDERS. They were not taken
   from any company policy. Set them to whatever your
   SOP actually says and re-run the ETL. The dashboard states on the page where
   the target came from, using `targetSource` below, so nobody mistakes a
   placeholder for policy.

   The two are different measures and are not interchangeable:

     npsTarget          A point on the Net Promoter Score scale, which runs
                        from -100 to +100. It is NOT a percentage. 50 is a
                        widely used "excellent" benchmark; 70+ is world class.
                        A target of "90" on this scale would be higher than
                        almost any company on earth achieves, so if your SOP
                        says 90 it is very unlikely to mean NPS.

     satisfactionTarget A true percentage: of everyone who rated a part of the
                        service as applicable, the share who chose "Satisfied".
                        This runs 0 to 100. A target of 90% here is normal and
                        achievable. If your SOP says "90%", this is almost
                        certainly the measure it means.
--------------------------------------------------------------------------- */
const THRESHOLDS = {
  minSampleForRanking: 10,   // below this a site is shown but flagged "low base"
  minSampleForTrend:   5,    // months below this are drawn hollow on the trend line

  npsTarget:           50,   // PLACEHOLDER. Scale is -100 to +100, not a percentage.
  satisfactionTarget:  90,   // PLACEHOLDER. A real percentage, 0 to 100.
  targetSource:        'Illustrative target for the public demo, not a company policy',

  npsWatch:            20,   // below this a site enters the watch list
  recoverySlaDays:     7,    // callback SLA for someone who asked to be contacted
  minResponsesForAccount: 2  // min responses before an account appears in the account view
};

/* Organisations that are really "our own lab / walk-in", not a referring account. */
const OWN_FACILITY_LABEL = 'Own branch / walk-in';
const OWN_FACILITY_PATTERNS = [
  /^demo\s*diagnostics/i, /^self$/i, /^walk\s*-?\s*in/i,
  /^personal$/i, /^individual$/i, /^myself$/i, /^me$/i, /^private$/i
];

module.exports = {
  SITE_CANON, SITE_REGION, HEADER_MAP, TOUCHPOINTS, THEMES,
  NULL_TEXT, THRESHOLDS, OWN_FACILITY_PATTERNS, OWN_FACILITY_LABEL, PUBLISH_CONTACT_DETAILS
};
