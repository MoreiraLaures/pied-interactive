import { Router, Request, Response } from 'express';

const help = Router();

help.get('/help', (req: Request, res: Response) => {
    return res.json({ status: 'ok' });
});

export default help;