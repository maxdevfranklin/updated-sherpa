import { FunctionCallResponse } from '../types/FunctionTypes';
import { VoiceSession } from '../models/VoiceSession';

export async function trustBuilding(args: any, session: VoiceSession): Promise<FunctionCallResponse> {
    // Validate required fields
    if (!args.firstName) {
        return { status: 'error', message: 'firstName not found. Please provide a valid firstName.' };
    }
    if (!args.lastName) {
        return { status: 'error', message: 'lastName not found. Please provide a valid lastName.' };
    }
    if (!args.locationInfo) {
        return { status: 'error', message: 'locationInfo not found. Please provide valid locationInfo.' };
    }
    if (!args.lovedOneName) {
        return { status: 'error', message: 'lovedOneName not found. Please provide a valid lovedOneName.' };
    }

    // Store validated values into session
    session.firstName = args.firstName;
    session.lastName = args.lastName;
    session.locationInfo = args.locationInfo;
    session.lovedOneName = args.lovedOneName;

    return {
        status: 'success',
        data: {
            firstName: args.firstName,
            lastName: args.lastName,
            locationInfo: args.locationInfo,
            lovedOneName: args.lovedOneName,
        }
    };
}

export async function situationDiscovery(args: any, session: VoiceSession): Promise<FunctionCallResponse> {
    if (!args.reasonForContact) {
        return { status: 'error', message: 'reasonForContact is missing.' };
    }
    if (!args.lovedOneConcern) {
        return { status: 'error', message: 'lovedOneConcern is missing.' };
    }
    if (!args.familyImpact) {
        return { status: 'error', message: 'familyImpact is missing.' };
    }
    if (!args.currentAddress) {
        return { status: 'error', message: 'currentAddress is missing.' };
    }

    session.reasonForContact = args.reasonForContact;
    session.lovedOneConcern = args.lovedOneConcern;
    session.familyImpact = args.familyImpact;
    session.currentAddress = args.currentAddress;

    return {
        status: 'success',
        data: {
            reasonForContact: args.reasonForContact,
            lovedOneConcern: args.lovedOneConcern,
            familyImpact: args.familyImpact,
            currentAddress: args.currentAddress
        }
    };
}

export async function lifestyleDiscovery(args: any, session: VoiceSession): Promise<FunctionCallResponse> {
    if (!args.dailyRoutine) {
        return { status: 'error', message: 'dailyRoutine is missing.' };
    }
    if (!args.hobbies) {
        return { status: 'error', message: 'hobbies is missing.' };
    }

    session.dailyRoutine = args.dailyRoutine;
    session.hobbies = args.hobbies;

    return {
        status: 'success',
        data: {
            dailyRoutine: args.dailyRoutine,
            hobbies: args.hobbies
        }
    };
}

export async function readinessDiscovery(args: any, session: VoiceSession): Promise<FunctionCallResponse> {
    if (!args.isLovedOneAware) {
        return { status: 'error', message: 'isLovedOneAware is missing.' };
    }
    if (!args.lovedOneFeelings) {
        return { status: 'error', message: 'lovedOneFeelings is missing.' };
    }
    if (!args.decisionMakers) {
        return { status: 'error', message: 'decisionMakers is missing.' };
    }

    session.isLovedOneAware = args.isLovedOneAware;
    session.lovedOneFeelings = args.lovedOneFeelings;
    session.decisionMakers = args.decisionMakers;

    return {
        status: 'success',
        data: {
            isLovedOneAware: args.isLovedOneAware,
            lovedOneFeelings: args.lovedOneFeelings,
            decisionMakers: args.decisionMakers
        }
    };
}

export async function prioritiesDiscovery(args: any, session: VoiceSession): Promise<FunctionCallResponse> {
    if (!args.communityPriorities) {
        return { status: 'error', message: 'communityPriorities is missing.' };
    }

    session.communityPriorities = args.communityPriorities;

    return {
        status: 'success',
        data: {
            communityPriorities: args.communityPriorities
        }
    };
}
