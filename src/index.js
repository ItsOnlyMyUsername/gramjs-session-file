#!/usr/bin/env node

const prompts = require('prompts')
const fs = require('fs')
const path = require('path')
const sqlite3 = require('sqlite3')
const { open } = require('sqlite')
const { StringSession } = require("telegram/sessions")
const { AuthKey } = require("telegram/crypto/AuthKey")

const convert = async (files, outputPath) => {
    const dbs = await Promise.all(
        files.map(file => open({
            filename: file,
            driver: sqlite3.Database
        }))
    )

    const sessions = (await Promise.allSettled(
        dbs.map(db => db.get('select * from sessions'))
    )).filter(({ status }) => status === 'fulfilled')

    const stringSessions = sessions.map(({ value: session }) => {
        const ss = new StringSession()

        const authKey = new AuthKey()

        authKey.setKey(Buffer.from(session.auth_key))

        ss.setDC(session.dc_id, session.server_address, session.port)
        ss.setAuthKey(authKey)

        return ss.save()
    })

    console.log(stringSessions)

    const outputFile = path.join(outputPath, './sessions.json')

    fs.writeFileSync(
        outputFile,
        JSON.stringify(stringSessions, null, 2),
        'utf-8'
    )

    console.log('String Sessions have been saved in', outputFile)
}

(async () => {
    const questions = [
        {
            type: 'text',
            name: 'inputPath',
            message: 'Please enter the path to the telethon session file or to the folder with session files',
            validate: input => fs.existsSync(input) || 'Not a valid path'
        },
        {
            type: 'text',
            name: 'outputPath',
            message: 'Please enter the path where result will be saved'
        }
    ];

    const { inputPath, outputPath } = await prompts(questions)

    const lstat = fs.lstatSync(inputPath)

    if (lstat.isDirectory()) {
        const files = fs
            .readdirSync(inputPath)
            .map(file => {
                const fullPath = path.join(inputPath, file)

                if (fs.lstatSync(fullPath).isFile() && file.endsWith('.session')) {
                    return file
                }
            })
            .filter(Boolean)

        await convert(files, outputPath)
    } else {
        await convert([inputPath], outputPath)
    }
})()