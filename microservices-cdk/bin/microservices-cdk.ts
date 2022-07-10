#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { MicroservicesCdkStack } from '../lib/microservices-cdk-stack';

const app = new cdk.App();
new MicroservicesCdkStack(app, 'MicroservicesCdkStack');
