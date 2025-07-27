import { ContentValidator } from '../lib/ai/content-validator'

async function testValidationFix() {
  console.log('🧪 Testing Content Validation Fix...\n')

  const validator = new ContentValidator()

  // Test content similar to what AI generates (around 600-700 words)
  const testContent = {
    title: "Arsenal's Striker Hunt: What Gyokeres Brings to the Team",
    content: `Arsenal's long search for a new striker appears to be over with the signing of Viktor Gyokeres. The Swedish international has been one of the most prolific goalscorers in European football over the past two seasons, and his arrival at the Emirates Stadium could be the missing piece in Mikel Arteta's title-chasing puzzle.

Gyokeres brings a different dimension to Arsenal's attack. Unlike the current forwards who prefer to drop deep and link play, Gyokeres is a traditional number nine who thrives on getting into scoring positions. His movement in the penalty area and clinical finishing have been key to his success at Sporting CP, where he scored 43 goals in 50 appearances last season.

The 26-year-old's physical presence will also be valuable for Arsenal. At 6'1", he provides a target for crosses and long balls, something the Gunners have lacked since Olivier Giroud's departure. His ability to hold up play and bring teammates into the game will complement the creative talents of Bukayo Saka, Gabriel Martinelli, and Martin Odegaard.

However, there are questions about how Gyokeres will adapt to the Premier League. The English top flight is known for its physicality and pace, and some players who excel in other European leagues struggle to make the transition. Arsenal fans will be hoping that Gyokeres can hit the ground running and help the team challenge for major honors.

The signing represents a significant investment from Arsenal, with reports suggesting the deal could be worth up to £85 million. This shows the club's ambition and their belief that Gyokeres can be the difference-maker in their quest for Premier League and Champions League success.

Only time will tell if Gyokeres can live up to expectations, but his track record suggests he has the quality to succeed at the highest level. Arsenal fans have every reason to be excited about this signing.`,
    excerpt: "Arsenal's signing of Viktor Gyokeres could be the missing piece in their title chase. The Swedish striker brings goals, physicality, and a different attacking dimension to the Emirates.",
    seoTitle: "Arsenal's Striker Hunt: What Gyokeres Brings to the Team",
    seoDescription: "Arsenal's signing of Viktor Gyokeres could be the missing piece in their title chase. The Swedish striker brings goals, physicality, and a different attacking dimension.",
    seoKeywords: ["arsenal", "gyokeres", "striker", "transfer", "premier league"],
    keywords: ["arsenal", "gyokeres", "striker", "transfer", "premier league"],
    category: "football",
    tags: ["arsenal", "transfers", "premier league"],
    readTime: 4
  }

  try {
    console.log('📝 Testing content validation with AI-generated content...')
    const result = await validator.validateContent(testContent)
    
    console.log(`✅ Validation completed!`)
    console.log(`   Score: ${result.score}`)
    console.log(`   Is Valid: ${result.isValid}`)
    console.log(`   Issues: ${result.issues.length}`)
    console.log(`   Suggestions: ${result.suggestions.length}`)
    
    if (result.isValid) {
      console.log('\n🎉 Content validation is working with AI-generated content!')
      console.log('   The blog automation should now save content successfully.')
    } else {
      console.log('\n⚠️ Content still failing validation. Issues:')
      result.issues.forEach(issue => console.log(`   - ${issue}`))
      console.log('\nSuggestions:')
      result.suggestions.forEach(suggestion => console.log(`   - ${suggestion}`))
    }

  } catch (error) {
    console.error('❌ Content validation test failed:', error)
  }
}

// Run the test
testValidationFix().catch(console.error) 