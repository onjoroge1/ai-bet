import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tip, userEmail } = await req.json()

    // Format email content
    const emailContent = `
      <h1>Your Premium Tip: ${tip.match.homeTeam.name} vs ${tip.match.awayTeam.name}</h1>
      
      <h2>Match Details</h2>
      <p>League: ${tip.match.league.name}</p>
      <p>Date: ${new Date(tip.match.dateTime).toLocaleString()}</p>
      
      <h2>Prediction</h2>
      <p><strong>${tip.prediction}</strong> @ ${tip.odds}</p>
      <p>Confidence: ${tip.confidence}%</p>
      
      <h2>Analysis</h2>
      <p>${tip.analysis}</p>
      
      <h2>Detailed Reasoning</h2>
      <ul>
        ${tip.detailedReasoning.map((reason: string) => `<li>${reason}</li>`).join("")}
      </ul>
      
      <h2>Extra Markets</h2>
      <ul>
        ${tip.extraMarkets.map((market: { name: string; odds: string; market: string; prediction: string; probability: number }) => `
          <li>
            <strong>${market.market}:</strong> ${market.prediction} (${market.probability}%)
          </li>
        `).join("")}
      </ul>
      
      <p>Thank you for your purchase! Good luck!</p>
    `

    // Send email
    await resend.emails.send({
      from: "tips@yourdomain.com",
      to: userEmail,
      subject: `Premium Tip: ${tip.match.homeTeam.name} vs ${tip.match.awayTeam.name}`,
      html: emailContent,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Email error:", error)
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
} 