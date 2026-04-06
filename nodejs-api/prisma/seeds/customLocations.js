const prisma = require('../client');

// Comprehensive US location data with ALL states and major cities
const US_LOCATION_DATA = {
    'Alabama': ['Birmingham', 'Montgomery', 'Mobile', 'Huntsville', 'Tuscaloosa', 'Hoover', 'Dothan', 'Auburn', 'Decatur', 'Madison', 'Florence', 'Gadsden', 'Vestavia Hills', 'Prattville', 'Phenix City', 'Alabaster', 'Bessemer', 'Enterprise', 'Opelika', 'Homewood'],
    'Alaska': ['Anchorage', 'Fairbanks', 'Juneau', 'Sitka', 'Ketchikan', 'Wasilla', 'Kenai', 'Kodiak', 'Bethel', 'Palmer', 'Homer', 'Unalaska', 'Soldotna', 'Barrow', 'Nome', 'Valdez', 'Seward', 'Kotzebue', 'Dillingham', 'Petersburg'],
    'Arizona': ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale', 'Glendale', 'Gilbert', 'Tempe', 'Peoria', 'Surprise', 'Yuma', 'Avondale', 'Flagstaff', 'Goodyear', 'Lake Havasu City', 'Buckeye', 'Casa Grande', 'Sierra Vista', 'Maricopa', 'Oro Valley', 'Prescott', 'Bullhead City', 'Prescott Valley', 'Apache Junction', 'Marana'],
    'Arkansas': ['Little Rock', 'Fort Smith', 'Fayetteville', 'Springdale', 'Jonesboro', 'North Little Rock', 'Conway', 'Rogers', 'Pine Bluff', 'Bentonville', 'Hot Springs', 'Benton', 'Sherwood', 'Texarkana', 'Russellville', 'Jacksonville', 'Bella Vista', 'Paragould', 'Cabot', 'Searcy'],
    'California': ['Los Angeles', 'San Diego', 'San Jose', 'San Francisco', 'Fresno', 'Sacramento', 'Long Beach', 'Oakland', 'Bakersfield', 'Anaheim', 'Santa Ana', 'Riverside', 'Stockton', 'Irvine', 'Chula Vista', 'Fremont', 'San Bernardino', 'Modesto', 'Fontana', 'Oxnard', 'Moreno Valley', 'Huntington Beach', 'Glendale', 'Santa Clarita', 'Garden Grove', 'Oceanside', 'Rancho Cucamonga', 'Santa Rosa', 'Ontario', 'Lancaster', 'Elk Grove', 'Corona', 'Palmdale', 'Salinas', 'Pomona', 'Hayward', 'Escondido', 'Torrance', 'Sunnyvale', 'Orange', 'Fullerton', 'Pasadena', 'Thousand Oaks', 'Visalia', 'Simi Valley', 'Concord', 'Roseville', 'Victorville', 'Santa Clara', 'Vallejo'],
    'Colorado': ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Lakewood', 'Thornton', 'Arvada', 'Westminster', 'Pueblo', 'Centennial', 'Boulder', 'Greeley', 'Longmont', 'Loveland', 'Grand Junction', 'Broomfield', 'Castle Rock', 'Commerce City', 'Parker', 'Littleton'],
    'Connecticut': ['Bridgeport', 'New Haven', 'Hartford', 'Stamford', 'Waterbury', 'Norwalk', 'Danbury', 'New Britain', 'Bristol', 'Meriden', 'Milford', 'West Haven', 'Middletown', 'Norwich', 'Shelton', 'Torrington', 'Stratford', 'East Hartford', 'Hamden', 'Trumbull'],
    'Delaware': ['Wilmington', 'Dover', 'Newark', 'Middletown', 'Smyrna', 'Milford', 'Seaford', 'Georgetown', 'Elsmere', 'New Castle', 'Millsboro', 'Laurel', 'Harrington', 'Camden', 'Clayton', 'Lewes', 'Milton', 'Selbyville', 'Bridgeville', 'Delmar'],
    'Florida': ['Jacksonville', 'Miami', 'Tampa', 'Orlando', 'St. Petersburg', 'Hialeah', 'Tallahassee', 'Fort Lauderdale', 'Port St. Lucie', 'Cape Coral', 'Pembroke Pines', 'Hollywood', 'Miramar', 'Coral Springs', 'Clearwater', 'Miami Gardens', 'Palm Bay', 'Pompano Beach', 'West Palm Beach', 'Lakeland', 'Davie', 'Miami Beach', 'Sunrise', 'Plantation', 'Boca Raton', 'Deltona', 'Largo', 'Deerfield Beach', 'Palm Coast', 'Melbourne', 'Boynton Beach', 'Lauderhill', 'Weston', 'Fort Myers', 'Kissimmee', 'Homestead', 'Tamarac', 'Delray Beach', 'Daytona Beach', 'North Miami'],
    'Georgia': ['Atlanta', 'Augusta', 'Columbus', 'Savannah', 'Athens', 'Sandy Springs', 'Roswell', 'Macon', 'Johns Creek', 'Albany', 'Warner Robins', 'Alpharetta', 'Marietta', 'Valdosta', 'Smyrna', 'Dunwoody', 'Rome', 'East Point', 'Milton', 'Gainesville'],
    'Hawaii': ['Honolulu', 'Pearl City', 'Hilo', 'Kailua', 'Waipahu', 'Kaneohe', 'Mililani Town', 'Kahului', 'Ewa Gentry', 'Kihei', 'Mililani Mauka', 'Makakilo', 'Wahiawa', 'Ewa Beach', 'Royal Kunia', 'Kapolei', 'Halawa', 'Wailuku', 'Waianae', 'Nanakuli'],
    'Idaho': ['Boise', 'Meridian', 'Nampa', 'Idaho Falls', 'Pocatello', 'Caldwell', 'Coeur d\'Alene', 'Twin Falls', 'Lewiston', 'Post Falls', 'Rexburg', 'Moscow', 'Eagle', 'Kuna', 'Ammon', 'Chubbuck', 'Hayden', 'Mountain Home', 'Blackfoot', 'Garden City'],
    'Illinois': ['Chicago', 'Aurora', 'Naperville', 'Joliet', 'Rockford', 'Springfield', 'Elgin', 'Peoria', 'Champaign', 'Waukegan', 'Cicero', 'Bloomington', 'Arlington Heights', 'Evanston', 'Decatur', 'Schaumburg', 'Bolingbrook', 'Palatine', 'Skokie', 'Des Plaines', 'Orland Park', 'Tinley Park', 'Oak Lawn', 'Berwyn', 'Mount Prospect', 'Normal', 'Wheaton', 'Hoffman Estates', 'Oak Park', 'Downers Grove'],
    'Indiana': ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Carmel', 'Fishers', 'Bloomington', 'Hammond', 'Gary', 'Muncie', 'Lafayette', 'Terre Haute', 'Kokomo', 'Anderson', 'Noblesville', 'Greenwood', 'Elkhart', 'Mishawaka', 'Lawrence', 'Jeffersonville'],
    'Iowa': ['Des Moines', 'Cedar Rapids', 'Davenport', 'Sioux City', 'Iowa City', 'Waterloo', 'Council Bluffs', 'Ames', 'West Des Moines', 'Dubuque', 'Ankeny', 'Urbandale', 'Cedar Falls', 'Marion', 'Bettendorf', 'Mason City', 'Marshalltown', 'Clinton', 'Burlington', 'Ottumwa'],
    'Kansas': ['Wichita', 'Overland Park', 'Kansas City', 'Olathe', 'Topeka', 'Lawrence', 'Shawnee', 'Manhattan', 'Lenexa', 'Salina', 'Hutchinson', 'Leavenworth', 'Leawood', 'Dodge City', 'Garden City', 'Junction City', 'Emporia', 'Derby', 'Prairie Village', 'Hays'],
    'Kentucky': ['Louisville', 'Lexington', 'Bowling Green', 'Owensboro', 'Covington', 'Richmond', 'Georgetown', 'Florence', 'Elizabethtown', 'Hopkinsville', 'Nicholasville', 'Henderson', 'Jeffersontown', 'Frankfort', 'Paducah', 'Independence', 'Radcliff', 'Ashland', 'Madisonville', 'Winchester'],
    'Louisiana': ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette', 'Lake Charles', 'Kenner', 'Bossier City', 'Monroe', 'Alexandria', 'Houma', 'New Iberia', 'Slidell', 'Prairieville', 'Central', 'Ruston', 'Sulphur', 'Hammond', 'Metairie', 'Marrero', 'Laplace'],
    'Maine': ['Portland', 'Lewiston', 'Bangor', 'South Portland', 'Auburn', 'Biddeford', 'Sanford', 'Saco', 'Augusta', 'Westbrook', 'Waterville', 'Presque Isle', 'Brunswick', 'Scarborough', 'Gorham', 'Windham', 'York', 'Falmouth', 'Kennebunk', 'Brewer'],
    'Maryland': ['Baltimore', 'Frederick', 'Rockville', 'Gaithersburg', 'Bowie', 'Hagerstown', 'Annapolis', 'College Park', 'Salisbury', 'Laurel', 'Greenbelt', 'Cumberland', 'Westminster', 'Hyattsville', 'Takoma Park', 'Easton', 'Elkton', 'Aberdeen', 'Havre de Grace', 'Cambridge'],
    'Massachusetts': ['Boston', 'Worcester', 'Springfield', 'Cambridge', 'Lowell', 'Brockton', 'Quincy', 'Lynn', 'New Bedford', 'Fall River', 'Newton', 'Lawrence', 'Somerville', 'Framingham', 'Haverhill', 'Waltham', 'Malden', 'Brookline', 'Plymouth', 'Medford', 'Taunton', 'Chicopee', 'Weymouth', 'Revere', 'Peabody'],
    'Michigan': ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Ann Arbor', 'Lansing', 'Flint', 'Dearborn', 'Livonia', 'Troy', 'Westland', 'Farmington Hills', 'Kalamazoo', 'Wyoming', 'Southfield', 'Rochester Hills', 'Taylor', 'Pontiac', 'St. Clair Shores', 'Royal Oak', 'Novi', 'Dearborn Heights', 'Battle Creek', 'Saginaw', 'Kentwood'],
    'Minnesota': ['Minneapolis', 'St. Paul', 'Rochester', 'Duluth', 'Bloomington', 'Brooklyn Park', 'Plymouth', 'St. Cloud', 'Eagan', 'Woodbury', 'Maple Grove', 'Eden Prairie', 'Coon Rapids', 'Burnsville', 'Blaine', 'Lakeville', 'Minnetonka', 'Apple Valley', 'Edina', 'St. Louis Park'],
    'Mississippi': ['Jackson', 'Gulfport', 'Southaven', 'Hattiesburg', 'Biloxi', 'Meridian', 'Tupelo', 'Greenville', 'Olive Branch', 'Horn Lake', 'Clinton', 'Pearl', 'Madison', 'Ridgeland', 'Starkville', 'Columbus', 'Vicksburg', 'Pascagoula', 'Brandon', 'Oxford'],
    'Missouri': ['Kansas City', 'St. Louis', 'Springfield', 'Columbia', 'Independence', 'Lee\'s Summit', 'O\'Fallon', 'St. Joseph', 'St. Charles', 'St. Peters', 'Blue Springs', 'Florissant', 'Joplin', 'Chesterfield', 'Jefferson City', 'Cape Girardeau', 'Oakville', 'Wildwood', 'University City', 'Ballwin'],
    'Montana': ['Billings', 'Missoula', 'Great Falls', 'Bozeman', 'Butte', 'Helena', 'Kalispell', 'Havre', 'Anaconda', 'Miles City', 'Belgrade', 'Livingston', 'Laurel', 'Whitefish', 'Lewistown', 'Sidney', 'Glendive', 'Polson', 'Hamilton', 'Columbia Falls'],
    'Nebraska': ['Omaha', 'Lincoln', 'Bellevue', 'Grand Island', 'Kearney', 'Fremont', 'Hastings', 'Norfolk', 'Columbus', 'Papillion', 'North Platte', 'La Vista', 'Scottsbluff', 'South Sioux City', 'Beatrice', 'Lexington', 'Alliance', 'Gering', 'York', 'McCook'],
    'Nevada': ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas', 'Sparks', 'Carson City', 'Fernley', 'Elko', 'Mesquite', 'Boulder City', 'Fallon', 'Winnemucca', 'West Wendover', 'Ely', 'Yerington', 'Carlin', 'Lovelock', 'Wells', 'Caliente', 'Tonopah'],
    'New Hampshire': ['Manchester', 'Nashua', 'Concord', 'Derry', 'Rochester', 'Salem', 'Dover', 'Merrimack', 'Londonderry', 'Hudson', 'Keene', 'Bedford', 'Portsmouth', 'Goffstown', 'Laconia', 'Hampton', 'Milford', 'Durham', 'Exeter', 'Windham'],
    'New Jersey': ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Edison', 'Woodbridge', 'Lakewood', 'Toms River', 'Hamilton', 'Trenton', 'Clifton', 'Camden', 'Brick', 'Brick Township', 'Cherry Hill', 'Passaic', 'Union City', 'Old Bridge', 'Gloucester Township', 'East Orange', 'Bayonne', 'Franklin', 'North Bergen', 'Vineland', 'Union', 'Piscataway'],
    'New Mexico': ['Albuquerque', 'Las Cruces', 'Rio Rancho', 'Santa Fe', 'Roswell', 'Farmington', 'Clovis', 'Hobbs', 'Alamogordo', 'Carlsbad', 'Gallup', 'Deming', 'Los Lunas', 'Chaparral', 'Sunland Park', 'Las Vegas', 'Portales', 'Los Alamos', 'North Valley', 'Silver City'],
    'New York': ['New York City', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse', 'Albany', 'New Rochelle', 'Mount Vernon', 'Schenectady', 'Utica', 'White Plains', 'Hempstead', 'Troy', 'Niagara Falls', 'Binghamton', 'Freeport', 'Valley Stream', 'Long Beach', 'Spring Valley', 'Levittown', 'Poughkeepsie', 'Cheektowaga', 'Irondequoit', 'Tonawanda', 'West Seneca'],
    'North Carolina': ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Fayetteville', 'Cary', 'Wilmington', 'High Point', 'Greenville', 'Asheville', 'Concord', 'Gastonia', 'Jacksonville', 'Chapel Hill', 'Rocky Mount', 'Burlington', 'Wilson', 'Huntersville', 'Kannapolis', 'Apex', 'Hickory', 'Goldsboro', 'Indian Trail', 'Mooresville'],
    'North Dakota': ['Fargo', 'Bismarck', 'Grand Forks', 'Minot', 'West Fargo', 'Williston', 'Dickinson', 'Mandan', 'Jamestown', 'Wahpeton', 'Devils Lake', 'Valley City', 'Grafton', 'Watford City', 'Lincoln', 'Beulah', 'Rugby', 'Horace', 'Casselton', 'Bottineau'],
    'Ohio': ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton', 'Parma', 'Canton', 'Youngstown', 'Lorain', 'Hamilton', 'Springfield', 'Kettering', 'Elyria', 'Lakewood', 'Cuyahoga Falls', 'Middletown', 'Euclid', 'Newark', 'Mansfield', 'Mentor', 'Beavercreek', 'Cleveland Heights', 'Strongsville', 'Dublin'],
    'Oklahoma': ['Oklahoma City', 'Tulsa', 'Norman', 'Broken Arrow', 'Lawton', 'Edmond', 'Moore', 'Midwest City', 'Enid', 'Stillwater', 'Muskogee', 'Bartlesville', 'Owasso', 'Shawnee', 'Ponca City', 'Ardmore', 'Duncan', 'Del City', 'Yukon', 'Bethany'],
    'Oregon': ['Portland', 'Salem', 'Eugene', 'Gresham', 'Hillsboro', 'Beaverton', 'Bend', 'Medford', 'Springfield', 'Corvallis', 'Albany', 'Tigard', 'Lake Oswego', 'Keizer', 'Grants Pass', 'Oregon City', 'McMinnville', 'Redmond', 'Tualatin', 'West Linn'],
    'Pennsylvania': ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie', 'Reading', 'Scranton', 'Bethlehem', 'Lancaster', 'Harrisburg', 'Altoona', 'York', 'State College', 'Wilkes-Barre', 'Chester', 'Williamsport', 'Easton', 'Lebanon', 'Hazleton', 'New Castle', 'Johnstown', 'McKeesport', 'Hermitage', 'Greensburg', 'Pottstown', 'Monroeville', 'Flinton'],
    'Rhode Island': ['Providence', 'Warwick', 'Cranston', 'Pawtucket', 'East Providence', 'Woonsocket', 'Coventry', 'Cumberland', 'North Providence', 'South Kingstown', 'West Warwick', 'Johnston', 'North Kingstown', 'Newport', 'Bristol', 'Westerly', 'Smithfield', 'Lincoln', 'Central Falls', 'Portsmouth'],
    'South Carolina': ['Charleston', 'Columbia', 'North Charleston', 'Mount Pleasant', 'Rock Hill', 'Greenville', 'Summerville', 'Sumter', 'Goose Creek', 'Hilton Head Island', 'Florence', 'Spartanburg', 'Myrtle Beach', 'Aiken', 'Anderson', 'Greer', 'Mauldin', 'Greenwood', 'North Augusta', 'Easley'],
    'South Dakota': ['Sioux Falls', 'Rapid City', 'Aberdeen', 'Brookings', 'Watertown', 'Mitchell', 'Yankton', 'Pierre', 'Huron', 'Spearfish', 'Vermillion', 'Brandon', 'Box Elder', 'Madison', 'Sturgis', 'Belle Fourche', 'Harrisburg', 'Tea', 'Dell Rapids', 'Lennox'],
    'Tennessee': ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville', 'Murfreesboro', 'Franklin', 'Jackson', 'Johnson City', 'Bartlett', 'Hendersonville', 'Kingsport', 'Collierville', 'Smyrna', 'Cleveland', 'Brentwood', 'Germantown', 'Columbia', 'Spring Hill', 'La Vergne'],
    'Texas': ['Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth', 'El Paso', 'Arlington', 'Corpus Christi', 'Plano', 'Laredo', 'Lubbock', 'Garland', 'Irving', 'Amarillo', 'Grand Prairie', 'Brownsville', 'Pasadena', 'McKinney', 'Mesquite', 'McAllen', 'Killeen', 'Frisco', 'Waco', 'Carrollton', 'Denton', 'Midland', 'Abilene', 'Beaumont', 'Round Rock', 'Odessa', 'Wichita Falls', 'Richardson', 'Lewisville', 'Tyler', 'College Station', 'Pearland', 'San Angelo', 'Allen', 'League City', 'Sugar Land'],
    'Utah': ['Salt Lake City', 'West Valley City', 'Provo', 'West Jordan', 'Orem', 'Sandy', 'Ogden', 'St. George', 'Layton', 'Taylorsville', 'South Jordan', 'Lehi', 'Logan', 'Murray', 'Draper', 'Bountiful', 'Riverton', 'Roy', 'Spanish Fork', 'Pleasant Grove'],
    'Vermont': ['Burlington', 'South Burlington', 'Rutland', 'Barre', 'Montpelier', 'Winooski', 'St. Albans', 'Newport', 'Vergennes', 'Essex Junction', 'Brattleboro', 'Hartford', 'Middlebury', 'Springfield', 'Bennington', 'St. Johnsbury', 'Colchester', 'Williston', 'Milton', 'Shelburne'],
    'Virginia': ['Virginia Beach', 'Norfolk', 'Chesapeake', 'Richmond', 'Newport News', 'Alexandria', 'Hampton', 'Roanoke', 'Portsmouth', 'Suffolk', 'Lynchburg', 'Harrisonburg', 'Leesburg', 'Charlottesville', 'Danville', 'Blacksburg', 'Manassas', 'Petersburg', 'Fredericksburg', 'Winchester'],
    'Washington': ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue', 'Kent', 'Everett', 'Renton', 'Yakima', 'Federal Way', 'Spokane Valley', 'Bellingham', 'Kennewick', 'Auburn', 'Pasco', 'Marysville', 'Lakewood', 'Redmond', 'Shoreline', 'Richland', 'Kirkland', 'Burien', 'Sammamish', 'Olympia', 'Lacey'],
    'West Virginia': ['Charleston', 'Huntington', 'Morgantown', 'Parkersburg', 'Wheeling', 'Weirton', 'Fairmont', 'Beckley', 'Martinsburg', 'Clarksburg', 'South Charleston', 'St. Albans', 'Vienna', 'Bluefield', 'Moundsville', 'Bridgeport', 'Oak Hill', 'Dunbar', 'Teays Valley', 'Cross Lanes'],
    'Wisconsin': ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha', 'Racine', 'Appleton', 'Waukesha', 'Eau Claire', 'Oshkosh', 'Janesville', 'West Allis', 'La Crosse', 'Sheboygan', 'Wauwatosa', 'Fond du Lac', 'New Berlin', 'Wausau', 'Brookfield', 'Greenfield', 'Beloit'],
    'Wyoming': ['Cheyenne', 'Casper', 'Laramie', 'Gillette', 'Rock Springs', 'Sheridan', 'Green River', 'Evanston', 'Riverton', 'Jackson', 'Cody', 'Rawlins', 'Lander', 'Torrington', 'Powell', 'Douglas', 'Worland', 'Buffalo', 'Newcastle', 'Wheatland'],
    'District of Columbia': ['Washington']
};


async function seedCustomLocations() {
    console.log('🌍 Starting Comprehensive Custom Location Seed...');

    try {
        let totalCreated = 0;
        let totalSkipped = 0;

        // Seed United States
        console.log('\n📍 Processing: United States');

        // Create country-level entry
        try {
            await prisma.customStateCity.create({
                data: { country: 'United States', state: null, city: null, isActive: true }
            });
            totalCreated++;
            console.log('  ✅ Created country: United States');
        } catch (error) {
            if (error.code === 'P2002') {
                console.log('  ⏭️  Country already exists: United States');
                totalSkipped++;
            } else {
                throw error;
            }
        }

        // Create state and city entries for US
        for (const [state, cities] of Object.entries(US_LOCATION_DATA)) {
            try {
                await prisma.customStateCity.create({
                    data: { country: 'United States', state, city: null, isActive: true }
                });
                totalCreated++;
                console.log(`    ✅ ${state}`);
            } catch (error) {
                if (error.code === 'P2002') {
                    totalSkipped++;
                } else {
                    console.error(`    ❌ Error creating state ${state}:`, error.message);
                }
            }

            // Create city entries
            for (const city of cities) {
                try {
                    await prisma.customStateCity.create({
                        data: { country: 'United States', state, city, isActive: true }
                    });
                    totalCreated++;
                } catch (error) {
                    if (error.code === 'P2002') {
                        totalSkipped++;
                    }
                }
            }
        }

        // Seed other countries
        for (const [country, statesData] of Object.entries(OTHER_COUNTRIES_DATA)) {
            console.log(`\n📍 Processing: ${country}`);

            try {
                await prisma.customStateCity.create({
                    data: { country, state: null, city: null, isActive: true }
                });
                totalCreated++;
                console.log(`  ✅ Created country: ${country}`);
            } catch (error) {
                if (error.code === 'P2002') {
                    console.log(`  ⏭️  Country already exists: ${country}`);
                    totalSkipped++;
                } else {
                    throw error;
                }
            }

            for (const [state, cities] of Object.entries(statesData)) {
                try {
                    await prisma.customStateCity.create({
                        data: { country, state, city: null, isActive: true }
                    });
                    totalCreated++;
                    console.log(`    ✅ ${state}`);
                } catch (error) {
                    if (error.code === 'P2002') {
                        totalSkipped++;
                    }
                }

                for (const city of cities) {
                    try {
                        await prisma.customStateCity.create({
                            data: { country, state, city, isActive: true }
                        });
                        totalCreated++;
                    } catch (error) {
                        if (error.code === 'P2002') {
                            totalSkipped++;
                        }
                    }
                }
            }
        }

        console.log('\n📊 Seed Summary:');
        console.log(`   ✅ Created: ${totalCreated} entries`);
        console.log(`   ⏭️  Skipped: ${totalSkipped} duplicates`);
        console.log(`   🇺🇸 US States: ${Object.keys(US_LOCATION_DATA).length}`);
        console.log(`   🌍 Other Countries: ${Object.keys(OTHER_COUNTRIES_DATA).length}`);
        console.log('🎉 Custom Location Seed Complete!');

    } catch (error) {
        console.error('❌ Seed failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run if called directly
if (require.main === module) {
    seedCustomLocations()
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { seedCustomLocations };
