import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from 'zod';
import { prisma } from "../lib/prisma";
import { getMailClient } from "../lib/mail";
import nodemailer from "nodemailer"
import { dayjs } from "../lib/dayjs";
import { ClientError } from "../errors/client-error";
import { env } from "../env";




export async function createInvite(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().post('/trips/:tripId/invites', {

        schema: {
            params: z.object({
                tripId: z.string().uuid()
            }),
            body: z.object({
                email: z.string().email()
            })
        }

    }, async (request) => {
        const { email } = request.body
        const {tripId} = request.params

        const trip = await prisma.trip.findUnique({
            where: {
                id: tripId
            }
        })

        if(!trip){
            throw new ClientError("Trip not found")
        }

        const participants = await prisma.participant.create({
            data: {
                email,
                trip_id: tripId,
            }
        })

       

        const formattedStartDate = dayjs(trip.starts_at).format('LL')
        const formattedEndDate = dayjs(trip.ends_at).format('LL')

        const confirmationLink = `http://${env.API_BASE_URL}/trips/${trip.id}/confirm`        

        const mail = await getMailClient();

        const message = await mail.sendMail({
            from: {
                name: 'Equipe plann.er',
                address: 'oi@plann.er',
            },

            to: participants.email,

            subject: `Confirme sua viagem para ${trip.destination} em ${formattedStartDate}`,
            html: `
              <div>
                <p>Você solicitou a criação de uma viagem para <strong>${trip.destination}</strong> nas datas de <strong>${formattedStartDate}</strong> até <strong>${formattedEndDate} </strong>.</p>
                <p></p>
                <p>Para confirmar sua viagem, clique no linque abaixo:</p>
                <p></p>
                <p> <a href="${confirmationLink}">Confirmar Viagem</a> </p>
                <p></p>
                <p>Caso você não saiba do que se trata esse e-mail, apenas ignore esse e-mail. </p>
              </div>  
            `.trim()
        })

        console.log(nodemailer.getTestMessageUrl(message))

        return { participant: participants.id}
    })
}